"""一键执行测试接口：在后台线程中运行 pytest，不阻塞请求。"""
import logging
import subprocess
import sys

from fastapi import APIRouter, BackgroundTasks

from utils.path_utils import project_root

logger = logging.getLogger("runner")
router = APIRouter(prefix="/api", tags=["runner"])

PROJECT_ROOT = project_root()


def _run_tests(files=None):
    """同步执行测试。files 为指定文件列表，None 时运行 tests 目录全部用例。"""
    if files:
        cmd = [sys.executable, "-m", "pytest", *files, "-v"]
    else:
        cmd = [sys.executable, "-m", "pytest", "tests", "-v"]
    logger.info("Running tests: %s", " ".join(cmd))
    result = subprocess.run(
        cmd,
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    if result.stdout:
        logger.info("pytest stdout:\n%s", result.stdout)
    if result.stderr:
        logger.error("pytest stderr:\n%s", result.stderr)
    logger.info("pytest exit code: %d", result.returncode)


@router.post("/run-tests")
async def run_tests(background: BackgroundTasks):
    """触发测试执行（后台运行），立即返回 started。"""
    background.add_task(_run_tests)
    return {"status": "started", "message": "测试执行中，请稍后刷新列表"}
