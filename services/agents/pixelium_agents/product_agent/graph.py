"""Product Agent LangGraph: Router -> [Search ∥ Filter] -> Rank | Think -> Cart Builder."""
from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from .nodes import parallel_search, route_action, router, sub_cart_builder, sub_think_cart
from .state import ProductState


def build_product_agent():
    g = StateGraph(ProductState)
    g.add_node("router", router)
    g.add_node("parallel_search", parallel_search)
    g.add_node("think_cart", sub_think_cart)
    g.add_node("build_cart", sub_cart_builder)

    g.add_edge(START, "router")
    g.add_conditional_edges(
        "router", route_action,
        {"search": "parallel_search", "build_cart": "think_cart"},
    )
    g.add_edge("parallel_search", END)
    g.add_edge("think_cart", "build_cart")
    g.add_edge("build_cart", END)
    return g.compile()
