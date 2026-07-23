"""用例结果统计相关的公共工具。"""


def summarize_cases(case_runs):
    """根据 CaseRun 列表统计 总数 / 通过 / 失败 / 通过率。

    返回 dict: {"total": int, "passed": int, "failed": int, "rate": str}
    """
    total = len(case_runs)
    passed = sum(1 for c in case_runs if c.status == "passed")
    failed = sum(1 for c in case_runs if c.status == "failed")
    rate = f"{passed / total * 100:.1f}%" if total else "0%"
    return {"total": total, "passed": passed, "failed": failed, "rate": rate}
