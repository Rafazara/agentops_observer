# AgentOps Database Backup System

Comprehensive backup solution for the AgentOps PostgreSQL database with support for multiple cloud storage providers, retention policies, and notifications.

## Quick Start

### Prerequisites

```bash
# Install required dependencies
pip install requests boto3 google-cloud-storage azure-storage-blob

# Ensure PostgreSQL client tools are installed
# Ubuntu/Debian:
sudo apt-get install postgresql-client

# macOS:
brew install postgresql
```

### Basic Usage

```bash
# Local backup (default)
python scripts/backup_database.py

# Backup to AWS S3
python scripts/backup_database.py --storage s3 --bucket my-backups

# Backup to Google Cloud Storage
python scripts/backup_database.py --storage gcs --bucket my-backups

# Backup to Azure Blob Storage
python scripts/backup_database.py --storage azure --bucket my-container

# With Slack notifications
python scripts/backup_database.py --storage s3 --bucket my-backups --notify slack
```

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (e.g., `postgresql://user:pass@host:5432/dbname`) |

### AWS S3

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_DEFAULT_REGION` | AWS region (optional, default: us-east-1) |

### Google Cloud Storage

| Variable | Description |
|----------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON file |

Or set credentials inline:
| Variable | Description |
|----------|-------------|
| `GCP_SERVICE_ACCOUNT_JSON` | Service account JSON as string |

### Azure Blob Storage

| Variable | Description |
|----------|-------------|
| `AZURE_STORAGE_CONNECTION_STRING` | Azure storage connection string |

### Notifications

| Variable | Description |
|----------|-------------|
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL |
| `DISCORD_WEBHOOK_URL` | Discord webhook URL |

## Command Line Options

| Option | Default | Description |
|--------|---------|-------------|
| `--storage` | `local` | Storage destination: `local`, `s3`, `gcs`, `azure` |
| `--bucket` | - | Cloud storage bucket/container name (required for cloud storage) |
| `--path` | `/tmp/agentops-backups` | Local backup directory |
| `--retention-days` | `30` | Days to keep old backups |
| `--notify` | - | Notification channel: `slack`, `discord` |
| `--no-compress` | - | Disable gzip compression |
| `--no-verify` | - | Skip backup verification |

## Automated Backups

### Using Cron (Linux/macOS)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/venv/bin/python /path/to/scripts/backup_database.py --storage s3 --bucket my-backups --notify slack >> /var/log/agentops-backup.log 2>&1
```

### Using Systemd Timer (Linux)

Create `/etc/systemd/system/agentops-backup.service`:

```ini
[Unit]
Description=AgentOps Database Backup
After=network.target

[Service]
Type=oneshot
User=agentops
ExecStart=/path/to/venv/bin/python /path/to/scripts/backup_database.py --storage s3 --bucket my-backups --notify slack
Environment="DATABASE_URL=postgresql://user:pass@host:5432/dbname"
Environment="AWS_ACCESS_KEY_ID=xxx"
Environment="AWS_SECRET_ACCESS_KEY=xxx"
Environment="SLACK_WEBHOOK_URL=xxx"
```

Create `/etc/systemd/system/agentops-backup.timer`:

```ini
[Unit]
Description=Run AgentOps backup daily

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable agentops-backup.timer
sudo systemctl start agentops-backup.timer
```

### Using GitHub Actions

Add to `.github/workflows/backup.yml`:

```yaml
name: Database Backup

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install requests boto3
          sudo apt-get install -y postgresql-client
      
      - name: Run backup
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          python scripts/backup_database.py \
            --storage s3 \
            --bucket ${{ vars.BACKUP_BUCKET }} \
            --retention-days 30 \
            --notify slack
```

## Restore from Backup

### From Local Backup

```bash
# Decompress if needed
gunzip agentops_backup_20240101_020000.sql.gz

# Restore
psql -h localhost -U postgres -d agentops < agentops_backup_20240101_020000.sql
```

### From S3

```bash
# Download
aws s3 cp s3://my-backups/backups/agentops_backup_20240101_020000.sql.gz ./

# Decompress
gunzip agentops_backup_20240101_020000.sql.gz

# Restore
psql -h localhost -U postgres -d agentops < agentops_backup_20240101_020000.sql
```

### From GCS

```bash
# Download
gsutil cp gs://my-backups/backups/agentops_backup_20240101_020000.sql.gz ./

# Decompress and restore
gunzip agentops_backup_20240101_020000.sql.gz
psql -h localhost -U postgres -d agentops < agentops_backup_20240101_020000.sql
```

### From Azure

```bash
# Download using Azure CLI
az storage blob download \
  --container-name my-container \
  --name backups/agentops_backup_20240101_020000.sql.gz \
  --file agentops_backup_20240101_020000.sql.gz

# Decompress and restore
gunzip agentops_backup_20240101_020000.sql.gz
psql -h localhost -U postgres -d agentops < agentops_backup_20240101_020000.sql
```

## Backup File Naming

Backups are named using the format:

```
agentops_backup_YYYYMMDD_HHMMSS.sql.gz
```

Example: `agentops_backup_20240115_020000.sql.gz`

## Retention Policy

The script automatically deletes backups older than the retention period (default: 30 days):

- Local backups: Files are deleted from the local directory
- Cloud backups: Files remain in cloud storage (use cloud provider lifecycle policies for cloud retention)

### S3 Lifecycle Policy

```json
{
  "Rules": [
    {
      "ID": "DeleteOldBackups",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "backups/"
      },
      "Expiration": {
        "Days": 90
      },
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        }
      ]
    }
  ]
}
```

### GCS Lifecycle Policy

```bash
gsutil lifecycle set lifecycle.json gs://my-backups
```

## Monitoring

### Check Backup Status

```bash
# View recent backup logs
tail -f backup.log

# List local backups
ls -la /tmp/agentops-backups/

# List S3 backups
aws s3 ls s3://my-backups/backups/
```

### Slack Notifications

Success notification:
```
✅ Database Backup Successful
Backup `agentops_backup_20240115_020000.sql.gz` completed successfully.
Size: 45.67 MB
Storage: s3
```

Failure notification:
```
❌ Database Backup Failed
Backup failed with error:
pg_dump: connection to server at "host" failed
```

## Troubleshooting

### pg_dump not found

Install PostgreSQL client tools:

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql

# Or use Docker
docker run --rm -v $(pwd):/backups postgres:15 pg_dump -h host -U user -d dbname > backup.sql
```

### Connection refused

Ensure the DATABASE_URL is correct and the database is accessible:

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### S3 upload failed

Check AWS credentials:

```bash
# Verify credentials
aws sts get-caller-identity

# Test bucket access
aws s3 ls s3://my-backups/
```

## Security Considerations

1. **Encrypt backups at rest** - Use server-side encryption (SSE) in S3/GCS/Azure
2. **Secure credentials** - Use IAM roles, managed identities, or secret managers
3. **Restrict bucket access** - Use bucket policies to limit access
4. **Enable versioning** - Enable bucket versioning for additional protection
5. **Test restores** - Regularly test backup restoration procedures
