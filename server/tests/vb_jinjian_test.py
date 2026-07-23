# Author: <NAME>
# Date: 2025-12-23 15:21:11
# Description: 进件测试用例




def test_loan_jinjian_flow(api):
    """示例：一个完整业务流程，包含 GET / POST / 文件上传，自行断言。"""

    # 待处理列表
    resp1 = api.post(
        "https://beta.vb.oa.com/boss_pub_platform/loan/apply/rmTodo/queryLoanApplyList",
        json={"status":[10,20,30,110],"postUpStatus":[5,25],"pageNum":1,"pageSize":20},
    )
    assert resp1.status_code == 200
    body1 = resp1.json()
    # 这里你自己判断要校验什么，例如：
    assert body1.get("code") == 0

    # 接口2：已完成列表
    resp2 = api.post(
        "https://beta.vb.oa.com/boss_pub_platform/loan/apply/rmTodo/queryLoanApplyDoneList",
        json={"status":[50,70],"pageNum":1,"pageSize":20},
    )
    assert resp2.status_code == 200
    body2 = resp2.json()
    # 自行校验返回内容，例如：
    assert body2.get("code") == 0


# def test_demo(api) :
#     assert 1 ==2
#
# def test_demo1(api) :
#     assert 1 ==2
#
# def test_demo2(api) :
#     assert 1 ==2
#
# def test_demo3(api) :
#     assert 1 ==2
#
# def test_demo4(api) :
#     assert 1 ==2
#
# def test_demo5(api) :
#     assert 1 ==1