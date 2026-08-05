"""Payment Agent LangGraph: [Sig ∥ Chain ∥ Amount ∥ Replay] -> Charge -> Explainer."""
from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from .nodes import parallel_proof, route_after_proof, sub_charge_executor, sub_explainer
from .state import PaymentState


def build_payment_agent():
    g = StateGraph(PaymentState)
    g.add_node("parallel_proof", parallel_proof)
    g.add_node("charge", sub_charge_executor)
    g.add_node("explain", sub_explainer)

    g.add_edge(START, "parallel_proof")
    g.add_conditional_edges(
        "parallel_proof", route_after_proof,
        {"charge": "charge", "explain": "explain"},
    )
    g.add_edge("charge", "explain")
    g.add_edge("explain", END)
    return g.compile()
