"""
Anomaly Detection Tests

Tests for cost spike, infinite loop, and quality degradation detection.
"""

import pytest

# Note: These are unit tests for anomaly detection functions
# They don't require HTTP client, just test the detection logic


# ============================================================================
# Detection Logic Tests
# ============================================================================

def detect_cost_spike(current_cost: float, average_cost: float, threshold: float = 5.0) -> bool:
    """Detect if current cost is significantly above average."""
    if average_cost <= 0:
        return False
    return current_cost > average_cost * threshold


def detect_infinite_loop(llm_calls: int, tool_progress: int, threshold: int = 20) -> bool:
    """
    Detect potential infinite loop.
    
    If many LLM calls with zero tool progress, likely stuck in a loop.
    """
    if llm_calls >= threshold and tool_progress == 0:
        return True
    return False


def detect_quality_degradation(
    current_score: float, 
    historical_avg: float, 
    threshold_pct: float = 20.0
) -> bool:
    """
    Detect quality score degradation.
    
    Returns True if current score is more than threshold% below historical average.
    """
    if historical_avg <= 0:
        return False
    
    drop_pct = ((historical_avg - current_score) / historical_avg) * 100
    return drop_pct >= threshold_pct


# ============================================================================
# Cost Spike Detection Tests
# ============================================================================

def test_detect_cost_spike_positive():
    """Cost 5x above average triggers spike detection."""
    current_cost = 5.0
    average_cost = 0.50  # 10x above average
    
    assert detect_cost_spike(current_cost, average_cost) is True


def test_detect_cost_spike_negative():
    """Normal cost does not trigger spike detection."""
    current_cost = 0.60
    average_cost = 0.50  # Only 1.2x above average
    
    assert detect_cost_spike(current_cost, average_cost) is False


def test_detect_cost_spike_edge_case():
    """Cost exactly at threshold (5x) should trigger."""
    current_cost = 2.50
    average_cost = 0.50  # Exactly 5x
    
    assert detect_cost_spike(current_cost, average_cost) is True


def test_detect_cost_spike_zero_average():
    """Zero average cost handles gracefully."""
    assert detect_cost_spike(1.0, 0.0) is False


# ============================================================================
# Infinite Loop Detection Tests
# ============================================================================

def test_detect_infinite_loop_positive():
    """25 LLM calls with 0 tool progress detects loop."""
    llm_calls = 25
    tool_progress = 0
    
    assert detect_infinite_loop(llm_calls, tool_progress) is True


def test_detect_infinite_loop_negative():
    """Normal execution with tool progress no loop detected."""
    llm_calls = 25
    tool_progress = 5  # Making progress
    
    assert detect_infinite_loop(llm_calls, tool_progress) is False


def test_detect_infinite_loop_few_calls():
    """Few LLM calls doesn't trigger even with no progress."""
    llm_calls = 10
    tool_progress = 0
    
    assert detect_infinite_loop(llm_calls, tool_progress) is False


# ============================================================================
# Quality Degradation Tests
# ============================================================================

def test_detect_quality_degradation_positive():
    """20% drop in quality triggers degradation."""
    current_score = 0.70
    historical_avg = 0.90  # 22% drop
    
    assert detect_quality_degradation(current_score, historical_avg) is True


def test_detect_quality_degradation_negative():
    """Small drop doesn't trigger degradation."""
    current_score = 0.85
    historical_avg = 0.90  # Only 5.5% drop
    
    assert detect_quality_degradation(current_score, historical_avg) is False


def test_detect_quality_degradation_improvement():
    """Score improvement (negative drop) doesn't trigger."""
    current_score = 0.95
    historical_avg = 0.90  # Actually improved
    
    assert detect_quality_degradation(current_score, historical_avg) is False


def test_detect_quality_degradation_zero_historical():
    """Zero historical average handles gracefully."""
    assert detect_quality_degradation(0.5, 0.0) is False


def test_detect_quality_degradation_exact_threshold():
    """Exactly at 20% threshold should trigger."""
    current_score = 0.80
    historical_avg = 1.0  # Exactly 20% drop
    
    assert detect_quality_degradation(current_score, historical_avg) is True
