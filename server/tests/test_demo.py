import requests


def test_baidu_access_pass():
    """访问百度首页，断言状态码 200（应该通过）。"""
    resp = requests.get("https://www.baidu.com/", timeout=10)
    assert resp.status_code == 200, f"期望 200，实际 {resp.status_code}"


def test_baidu_access_fail():
    """访问百度首页，故意断言状态码 404（应该失败）。"""
    resp = requests.get("https://www.baidu.com/", timeout=10)
    assert resp.status_code == 404, f"期望 404，实际 {resp.status_code}"
