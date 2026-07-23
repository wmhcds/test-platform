"""日志相关的公共工具：同时输出到控制台与文件。"""


class TeeLogger:
    """把日志同时写到控制台和指定文件，便于 IDE 右键运行时也能在文件里看到完整日志。"""

    def __init__(self, path):
        self._f = open(path, "w", encoding="utf-8")

    def log(self, msg=""):
        """同时打印到控制台并写入文件。"""
        print(msg)
        self._f.write(str(msg) + "\n")
        self._f.flush()

    def write_raw(self, msg):
        """仅写入文件（用于超长内容，避免刷屏控制台）。"""
        self._f.write(str(msg) + "\n")
        self._f.flush()

    def close(self):
        self._f.close()
