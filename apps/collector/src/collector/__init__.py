"""
AgentOps Collector Service

High-throughput event collector that processes events from Kafka
and performs aggregations, anomaly detection, and alerting.
"""

from collector.main import app

__all__ = ["app"]
