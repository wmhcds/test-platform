def test_demo_pass():
    """演示用例：不依赖内网，永远通过。"""
    assert 1 + 1 == 2


def test_demo_math():
    """另一个演示用例。"""
    assert "hello".upper() == "HELLO"
