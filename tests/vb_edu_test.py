# Author: <NAME>
# Date: 2025-12-10 15:12:12
# Description:
# LastEditTime: 2025-12-10 15:12:12
# LastEditors: <NAME>
# Copyright: Copyright (c) 2025
# 额度测试

def test_loan_edu_flow(api):
    #额度调整申请提交
    resp1 = api.post("https://beta.vb.oa.com/boss_pub_platform/creditLimitAdjust/getSubmitList",
             json={"page_num":1,"page_size":20,"params":{"state_list":["CHECK_RETURN"],"workflow_type_list":["CREDIT_LIMIT_ADJUST"]}})
    assert resp1.status_code == 200
    body1 = resp1.json()
    assert body1.get("code") == 0
    #assert body1.get("data").get("list")[0].get("id") is not None


# def test_demo(api):
#     assert 1 == 2
#
#
# def test_demo1(api):
#     assert 1 == 2
#
#
# def test_demo2(api):
#     assert 1 == 2
#
#
# def test_demo3(api):
#     assert 1 == 2
#
#
# def test_demo4(api):
#     assert 1 == 2
#
#
# def test_demo5(api):
#     assert 1 == 1