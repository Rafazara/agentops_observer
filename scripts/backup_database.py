#!/usr/bin/env python3
"""
Database Backup Script for AgentOps Observer

This script performs automated backups of the PostgreSQL database with support for:
- Full database dumps with compression
- Uploading to AWS S3, Google Cloud Storage, or Azure Blob Storage
- Retention policies for automatic cleanup
- Slack/Discord notifications
- Backup verification

Usage:
    python backup_database.py --storage s3 --bucket my-backups
    python backup_database.py --storage gcs --bucket my-backups --notify slack
    python backup_database.py --storage local --path /backups
    
Environment Variables:
    DATABASE_URL - PostgreSQL connection string
    AWS_ACCESS_KEY_ID - AWS credentials (for S3)
    AWS_SECRET_ACCESS_KEY - AWS credentials (for S3)
    GCP_SERVICE_ACCOUNT_JSON - GCP credentials (for GCS)
    AZURE_STORAGE_CONNECTION_STRING - Azure credentials
    SLACK_WEBHOOK_URL - Slack notification webhook
    DISCORD_WEBHOOK_URL - Discord notification webhook
"""

import argparse
import gzip
import hashlib
import json
import logging
import os
import shutil
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("backup.log"),
    ],
)
logger = logging.getLogger(__name__)


class BackupConfig:
    """Backup configuration"""
    
    def __init__(
        self,
        storage: str = "local",
        bucket: Optional[str] = None,
        path: Optional[str] = None,
        retention_days: int = 30,
        notify: Optional[str] = None,
        compress: bool = True,
        verify: bool = True,
    ):
        self.storage = storage
        self.bucket = bucket
        self.path = path or "/tmp/backups"
        self.retention_days = retention_days
        self.notify = notify
        self.compress = compress
        self.verify = verify
        
        # Get database URL from environment
        self.database_url = os.environ.get("DATABASE_URL")
        if not self.database_url:
            raise ValueError("DATABASE_URL environment variable is required")


class DatabaseBackup:
    """PostgreSQL database backup handler"""
    
    def __init__(self, config: BackupConfig):
        self.config = config
        self.timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        self.backup_name = f"agentops_backup_{self.timestamp}"
        
    def run(self) -> bool:
        """Execute the backup process"""
        try:
            logger.info("Starting database backup...")
            
            # Step 1: Create backup directory
            backup_dir = Path(self.config.path)
            backup_dir.mkdir(parents=True, exist_ok=True)
            
            # Step 2: Perform pg_dump
            dump_file = self._perform_dump(backup_dir)
            if not dump_file:
                self._notify_failure("Failed to create database dump")
                return False
            
            # Step 3: Compress if enabled
            if self.config.compress:
                dump_file = self._compress_file(dump_file)
            
            # Step 4: Calculate checksum
            checksum = self._calculate_checksum(dump_file)
            logger.info(f"Backup checksum (SHA256): {checksum}")
            
            # Step 5: Upload to storage
            if self.config.storage != "local":
                success = self._upload_to_storage(dump_file)
                if not success:
                    self._notify_failure("Failed to upload backup to storage")
                    return False
            
            # Step 6: Verify backup if enabled
            if self.config.verify:
                if not self._verify_backup(dump_file):
                    self._notify_failure("Backup verification failed")
                    return False
            
            # Step 7: Cleanup old backups
            self._cleanup_old_backups()
            
            # Step 8: Get backup size
            backup_size = dump_file.stat().st_size
            backup_size_mb = backup_size / (1024 * 1024)
            
            # Step 9: Notify success
            self._notify_success(
                backup_name=dump_file.name,
                size_mb=backup_size_mb,
                checksum=checksum,
            )
            
            logger.info(f"Backup completed successfully: {dump_file.name} ({backup_size_mb:.2f} MB)")
            return True
            
        except Exception as e:
            logger.exception("Backup failed with exception")
            self._notify_failure(str(e))
            return False
    
    def _perform_dump(self, backup_dir: Path) -> Optional[Path]:
        """Perform pg_dump"""
        dump_file = backup_dir / f"{self.backup_name}.sql"
        
        # Parse database URL
        parsed = urlparse(self.config.database_url)
        
        env = os.environ.copy()
        env["PGPASSWORD"] = parsed.password or ""
        
        cmd = [
            "pg_dump",
            "-h", parsed.hostname or "localhost",
            "-p", str(parsed.port or 5432),
            "-U", parsed.username or "postgres",
            "-d", parsed.path.lstrip("/"),
            "-F", "p",  # Plain format
            "--no-owner",
            "--no-acl",
            "-f", str(dump_file),
        ]
        
        try:
            logger.info(f"Running pg_dump to {dump_file}...")
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=3600,  # 1 hour timeout
            )
            
            if result.returncode != 0:
                logger.error(f"pg_dump failed: {result.stderr}")
                return None
            
            logger.info(f"pg_dump completed successfully")
            return dump_file
            
        except subprocess.TimeoutExpired:
            logger.error("pg_dump timed out after 1 hour")
            return None
        except FileNotFoundError:
            logger.error("pg_dump not found. Make sure PostgreSQL client tools are installed.")
            return None
    
    def _compress_file(self, file_path: Path) -> Path:
        """Compress file using gzip"""
        compressed_path = file_path.with_suffix(file_path.suffix + ".gz")
        
        logger.info(f"Compressing {file_path.name}...")
        
        with open(file_path, "rb") as f_in:
            with gzip.open(compressed_path, "wb", compresslevel=9) as f_out:
                shutil.copyfileobj(f_in, f_out)
        
        # Remove original file
        file_path.unlink()
        
        original_size = file_path.stat().st_size if file_path.exists() else 0
        compressed_size = compressed_path.stat().st_size
        
        logger.info(f"Compressed to {compressed_path.name} (compression ratio: {compressed_size/max(original_size, 1):.2%})")
        
        return compressed_path
    
    def _calculate_checksum(self, file_path: Path) -> str:
        """Calculate SHA256 checksum"""
        sha256_hash = hashlib.sha256()
        
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256_hash.update(chunk)
        
        return sha256_hash.hexdigest()
    
    def _upload_to_storage(self, file_path: Path) -> bool:
        """Upload backup to cloud storage"""
        if self.config.storage == "s3":
            return self._upload_to_s3(file_path)
        elif self.config.storage == "gcs":
            return self._upload_to_gcs(file_path)
        elif self.config.storage == "azure":
            return self._upload_to_azure(file_path)
        else:
            logger.warning(f"Unknown storage type: {self.config.storage}")
            return False
    
    def _upload_to_s3(self, file_path: Path) -> bool:
        """Upload to AWS S3"""
        try:
            import boto3
            from botocore.exceptions import BotoCoreError, ClientError
            
            logger.info(f"Uploading to S3 bucket: {self.config.bucket}")
            
            s3_client = boto3.client("s3")
            s3_key = f"backups/{file_path.name}"
            
            s3_client.upload_file(
                str(file_path),
                self.config.bucket,
                s3_key,
                ExtraArgs={"StorageClass": "STANDARD_IA"},
            )
            
            logger.info(f"Uploaded to s3://{self.config.bucket}/{s3_key}")
            return True
            
        except ImportError:
            logger.error("boto3 not installed. Run: pip install boto3")
            return False
        except (BotoCoreError, ClientError) as e:
            logger.error(f"S3 upload failed: {e}")
            return False
    
    def _upload_to_gcs(self, file_path: Path) -> bool:
        """Upload to Google Cloud Storage"""
        try:
            from google.cloud import storage
            from google.auth.exceptions import GoogleAuthError
            
            logger.info(f"Uploading to GCS bucket: {self.config.bucket}")
            
            client = storage.Client()
            bucket = client.bucket(self.config.bucket)
            blob = bucket.blob(f"backups/{file_path.name}")
            
            blob.upload_from_filename(str(file_path))
            
            logger.info(f"Uploaded to gs://{self.config.bucket}/backups/{file_path.name}")
            return True
            
        except ImportError:
            logger.error("google-cloud-storage not installed. Run: pip install google-cloud-storage")
            return False
        except GoogleAuthError as e:
            logger.error(f"GCS authentication failed: {e}")
            return False
    
    def _upload_to_azure(self, file_path: Path) -> bool:
        """Upload to Azure Blob Storage"""
        try:
            from azure.storage.blob import BlobServiceClient
            from azure.core.exceptions import AzureError
            
            logger.info(f"Uploading to Azure container: {self.config.bucket}")
            
            connection_string = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
            if not connection_string:
                logger.error("AZURE_STORAGE_CONNECTION_STRING not set")
                return False
            
            blob_service_client = BlobServiceClient.from_connection_string(connection_string)
            container_client = blob_service_client.get_container_client(self.config.bucket)
            
            blob_client = container_client.get_blob_client(f"backups/{file_path.name}")
            
            with open(file_path, "rb") as data:
                blob_client.upload_blob(data, overwrite=True)
            
            logger.info(f"Uploaded to Azure: {self.config.bucket}/backups/{file_path.name}")
            return True
            
        except ImportError:
            logger.error("azure-storage-blob not installed. Run: pip install azure-storage-blob")
            return False
        except AzureError as e:
            logger.error(f"Azure upload failed: {e}")
            return False
    
    def _verify_backup(self, file_path: Path) -> bool:
        """Verify backup integrity"""
        logger.info("Verifying backup integrity...")
        
        try:
            # For compressed files, verify gzip integrity
            if file_path.suffix == ".gz":
                with gzip.open(file_path, "rb") as f:
                    # Read through entire file to verify integrity
                    while f.read(8192):
                        pass
                logger.info("Gzip integrity verified")
            
            # Verify file is not empty
            if file_path.stat().st_size == 0:
                logger.error("Backup file is empty")
                return False
            
            logger.info("Backup verification passed")
            return True
            
        except Exception as e:
            logger.error(f"Backup verification failed: {e}")
            return False
    
    def _cleanup_old_backups(self):
        """Remove backups older than retention period"""
        logger.info(f"Cleaning up backups older than {self.config.retention_days} days...")
        
        cutoff_date = datetime.utcnow() - timedelta(days=self.config.retention_days)
        backup_dir = Path(self.config.path)
        
        deleted_count = 0
        for backup_file in backup_dir.glob("agentops_backup_*"):
            try:
                # Parse timestamp from filename
                timestamp_str = backup_file.stem.split("_")[2] + "_" + backup_file.stem.split("_")[3].split(".")[0]
                backup_date = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
                
                if backup_date < cutoff_date:
                    backup_file.unlink()
                    deleted_count += 1
                    logger.info(f"Deleted old backup: {backup_file.name}")
            except (IndexError, ValueError):
                # Skip files that don't match expected format
                continue
        
        logger.info(f"Cleaned up {deleted_count} old backups")
    
    def _notify_success(self, backup_name: str, size_mb: float, checksum: str):
        """Send success notification"""
        message = {
            "status": "success",
            "backup_name": backup_name,
            "size_mb": f"{size_mb:.2f}",
            "checksum": checksum[:16] + "...",
            "timestamp": self.timestamp,
            "storage": self.config.storage,
        }
        
        self._send_notification(
            title="✅ Database Backup Successful",
            message=f"Backup `{backup_name}` completed successfully.\n"
                    f"Size: {size_mb:.2f} MB\n"
                    f"Storage: {self.config.storage}",
            color="#00ff00",
        )
    
    def _notify_failure(self, error: str):
        """Send failure notification"""
        self._send_notification(
            title="❌ Database Backup Failed",
            message=f"Backup failed with error:\n```{error}```",
            color="#ff0000",
        )
    
    def _send_notification(self, title: str, message: str, color: str):
        """Send notification to configured channel"""
        if not self.config.notify:
            return
        
        try:
            if self.config.notify == "slack":
                self._send_slack_notification(title, message, color)
            elif self.config.notify == "discord":
                self._send_discord_notification(title, message, color)
            else:
                logger.warning(f"Unknown notification type: {self.config.notify}")
        except Exception as e:
            logger.error(f"Failed to send notification: {e}")
    
    def _send_slack_notification(self, title: str, message: str, color: str):
        """Send Slack notification"""
        webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
        if not webhook_url:
            logger.warning("SLACK_WEBHOOK_URL not set")
            return
        
        payload = {
            "attachments": [
                {
                    "fallback": title,
                    "color": color,
                    "title": title,
                    "text": message,
                    "footer": "AgentOps Backup System",
                    "ts": int(datetime.utcnow().timestamp()),
                }
            ]
        }
        
        response = requests.post(webhook_url, json=payload, timeout=10)
        response.raise_for_status()
        logger.info("Slack notification sent")
    
    def _send_discord_notification(self, title: str, message: str, color: str):
        """Send Discord notification"""
        webhook_url = os.environ.get("DISCORD_WEBHOOK_URL")
        if not webhook_url:
            logger.warning("DISCORD_WEBHOOK_URL not set")
            return
        
        # Convert hex color to int
        color_int = int(color.lstrip("#"), 16)
        
        payload = {
            "embeds": [
                {
                    "title": title,
                    "description": message,
                    "color": color_int,
                    "footer": {"text": "AgentOps Backup System"},
                    "timestamp": datetime.utcnow().isoformat(),
                }
            ]
        }
        
        response = requests.post(webhook_url, json=payload, timeout=10)
        response.raise_for_status()
        logger.info("Discord notification sent")


def main():
    parser = argparse.ArgumentParser(description="AgentOps Database Backup Script")
    
    parser.add_argument(
        "--storage",
        choices=["local", "s3", "gcs", "azure"],
        default="local",
        help="Storage destination (default: local)",
    )
    parser.add_argument(
        "--bucket",
        help="Cloud storage bucket name",
    )
    parser.add_argument(
        "--path",
        default="/tmp/agentops-backups",
        help="Local backup directory (default: /tmp/agentops-backups)",
    )
    parser.add_argument(
        "--retention-days",
        type=int,
        default=30,
        help="Backup retention period in days (default: 30)",
    )
    parser.add_argument(
        "--notify",
        choices=["slack", "discord"],
        help="Notification channel",
    )
    parser.add_argument(
        "--no-compress",
        action="store_true",
        help="Disable gzip compression",
    )
    parser.add_argument(
        "--no-verify",
        action="store_true",
        help="Skip backup verification",
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.storage in ["s3", "gcs", "azure"] and not args.bucket:
        parser.error(f"--bucket is required when using {args.storage} storage")
    
    config = BackupConfig(
        storage=args.storage,
        bucket=args.bucket,
        path=args.path,
        retention_days=args.retention_days,
        notify=args.notify,
        compress=not args.no_compress,
        verify=not args.no_verify,
    )
    
    backup = DatabaseBackup(config)
    success = backup.run()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
