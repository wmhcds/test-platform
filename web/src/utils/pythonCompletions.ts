/**
 * Python 代码补全工具
 * - 静态补全：Python 关键字、内置函数、pytest/requests API（即时响应）
 * - Pyodide 补全：延迟加载，提供成员访问补全（如 requests.get、json.loads 等）
 */

// --------------------------------------------------------------
// 静态补全数据
// --------------------------------------------------------------

interface CompletionItemDef {
  label: string
  kind: number // monaco.languages.CompletionItemKind
  detail: string
  documentation: string
  insertText?: string
}

function buildKeywordCompletions(): CompletionItemDef[] {
  const k = 14 // Keyword
  const s = 25 // Snippet
  return [
    { label: 'False', kind: k, detail: '关键字', documentation: '布尔假值' },
    { label: 'None', kind: k, detail: '关键字', documentation: '空值 / NoneType 的唯一值' },
    { label: 'True', kind: k, detail: '关键字', documentation: '布尔真值' },
    { label: 'and', kind: k, detail: '关键字', documentation: '逻辑与' },
    { label: 'as', kind: k, detail: '关键字', documentation: '别名导入 / with-as 上下文' },
    { label: 'assert', kind: k, detail: '关键字', documentation: '断言条件为真，否则抛出 AssertionError', insertText: 'assert ${1:condition}' },
    { label: 'async', kind: k, detail: '关键字', documentation: '声明异步函数' },
    { label: 'await', kind: k, detail: '关键字', documentation: '等待协程结果' },
    { label: 'break', kind: k, detail: '关键字', documentation: '跳出当前循环' },
    { label: 'class', kind: k, detail: '关键字', documentation: '定义类' },
    { label: 'continue', kind: k, detail: '关键字', documentation: '跳过本次循环余下代码' },
    { label: 'def', kind: k, detail: '关键字', documentation: '定义函数', insertText: 'def ${1:name}(${2:args}):\n    ${3:pass}' },
    { label: 'del', kind: k, detail: '关键字', documentation: '删除对象 / 元素' },
    { label: 'elif', kind: k, detail: '关键字', documentation: '条件分支 else if' },
    { label: 'else', kind: k, detail: '关键字', documentation: '条件 / 循环 else 分支' },
    { label: 'except', kind: k, detail: '关键字', documentation: '异常捕获' },
    { label: 'finally', kind: k, detail: '关键字', documentation: '最终执行块（无论是否异常）' },
    { label: 'for', kind: k, detail: '关键字', documentation: '循环', insertText: 'for ${1:item} in ${2:iterable}:\n    ${3:pass}' },
    { label: 'from', kind: k, detail: '关键字', documentation: '从模块导入', insertText: 'from ${1:module} import ${2:name}' },
    { label: 'global', kind: k, detail: '关键字', documentation: '声明使用全局变量' },
    { label: 'if', kind: k, detail: '关键字', documentation: '条件判断', insertText: 'if ${1:condition}:\n    ${2:pass}' },
    { label: 'import', kind: k, detail: '关键字', documentation: '导入模块', insertText: 'import ${1:module}' },
    { label: 'in', kind: k, detail: '关键字', documentation: '成员运算符' },
    { label: 'is', kind: k, detail: '关键字', documentation: '身份运算符' },
    { label: 'lambda', kind: k, detail: '关键字', documentation: '匿名函数', insertText: 'lambda ${1:args}: ${2:expr}' },
    { label: 'nonlocal', kind: k, detail: '关键字', documentation: '声明使用外层（非全局）变量' },
    { label: 'not', kind: k, detail: '关键字', documentation: '逻辑非' },
    { label: 'or', kind: k, detail: '关键字', documentation: '逻辑或' },
    { label: 'pass', kind: k, detail: '关键字', documentation: '占位语句' },
    { label: 'raise', kind: k, detail: '关键字', documentation: '抛出异常', insertText: 'raise ${1:Exception}(${2:msg})' },
    { label: 'return', kind: k, detail: '关键字', documentation: '函数返回', insertText: 'return ${1:value}' },
    { label: 'try', kind: k, detail: '关键字', documentation: '尝试执行（捕获异常）' },
    { label: 'while', kind: k, detail: '关键字', documentation: '条件循环', insertText: 'while ${1:condition}:\n    ${2:pass}' },
    { label: 'with', kind: k, detail: '关键字', documentation: '上下文管理器', insertText: 'with ${1:expr} as ${2:var}:\n    ${3:pass}' },
    { label: 'yield', kind: k, detail: '关键字', documentation: '生成器产出值' },
  ]
}

function buildBuiltinCompletions(): CompletionItemDef[] {
  const f = 1 // Function
  const c = 4 // Class
  const v = 5 // Variable
  return [
    // 常用内置函数
    { label: 'abs', kind: f, detail: '内置函数', documentation: '返回绝对值', insertText: 'abs(${1:x})' },
    { label: 'all', kind: f, detail: '内置函数', documentation: '可迭代对象全 True → True', insertText: 'all(${1:iterable})' },
    { label: 'any', kind: f, detail: '内置函数', documentation: '可迭代对象任一 True → True', insertText: 'any(${1:iterable})' },
    { label: 'bin', kind: f, detail: '内置函数', documentation: '整数 → 二进制字符串' },
    { label: 'bool', kind: c, detail: '内置类', documentation: '布尔类型' },
    { label: 'bytearray', kind: c, detail: '内置类', documentation: '可变字节数组' },
    { label: 'bytes', kind: c, detail: '内置类', documentation: '不可变字节序列' },
    { label: 'callable', kind: f, detail: '内置函数', documentation: '对象是否可调用' },
    { label: 'chr', kind: f, detail: '内置函数', documentation: 'Unicode 码点 → 字符' },
    { label: 'classmethod', kind: f, detail: '内置装饰器', documentation: '声明类方法' },
    { label: 'compile', kind: f, detail: '内置函数', documentation: '编译源码为代码对象' },
    { label: 'complex', kind: c, detail: '内置类', documentation: '复数类型' },
    { label: 'delattr', kind: f, detail: '内置函数', documentation: '删除对象属性' },
    { label: 'dict', kind: c, detail: '内置类', documentation: '字典类型', insertText: 'dict()' },
    { label: 'dir', kind: f, detail: '内置函数', documentation: '列出对象属性名', insertText: 'dir(${1:obj})' },
    { label: 'divmod', kind: f, detail: '内置函数', documentation: '返回商和余数元组' },
    { label: 'enumerate', kind: f, detail: '内置函数', documentation: '枚举（索引, 值）', insertText: 'enumerate(${1:iterable})' },
    { label: 'eval', kind: f, detail: '内置函数', documentation: '执行字符串表达式' },
    { label: 'exec', kind: f, detail: '内置函数', documentation: '执行字符串代码块' },
    { label: 'filter', kind: f, detail: '内置函数', documentation: '按条件过滤', insertText: 'filter(${1:func}, ${2:iterable})' },
    { label: 'float', kind: c, detail: '内置类', documentation: '浮点数类型' },
    { label: 'format', kind: f, detail: '内置函数', documentation: '格式化字符串' },
    { label: 'frozenset', kind: c, detail: '内置类', documentation: '不可变集合' },
    { label: 'getattr', kind: f, detail: '内置函数', documentation: '获取对象属性', insertText: 'getattr(${1:obj}, "${2:name}")' },
    { label: 'globals', kind: f, detail: '内置函数', documentation: '返回全局命名空间字典' },
    { label: 'hasattr', kind: f, detail: '内置函数', documentation: '对象是否有某属性', insertText: 'hasattr(${1:obj}, "${2:name}")' },
    { label: 'hash', kind: f, detail: '内置函数', documentation: '返回对象哈希值' },
    { label: 'hex', kind: f, detail: '内置函数', documentation: '整数 → 十六进制字符串' },
    { label: 'id', kind: f, detail: '内置函数', documentation: '返回对象唯一标识' },
    { label: 'input', kind: f, detail: '内置函数', documentation: '从标准输入读字符串' },
    { label: 'int', kind: c, detail: '内置类', documentation: '整数类型' },
    { label: 'isinstance', kind: f, detail: '内置函数', documentation: '判断类型匹配', insertText: 'isinstance(${1:obj}, ${2:type})' },
    { label: 'issubclass', kind: f, detail: '内置函数', documentation: '判断子类关系' },
    { label: 'iter', kind: f, detail: '内置函数', documentation: '获取迭代器' },
    { label: 'len', kind: f, detail: '内置函数', documentation: '返回对象长度', insertText: 'len(${1:obj})' },
    { label: 'list', kind: c, detail: '内置类', documentation: '列表类型', insertText: 'list()' },
    { label: 'locals', kind: f, detail: '内置函数', documentation: '返回局部命名空间字典' },
    { label: 'map', kind: f, detail: '内置函数', documentation: '对每个元素应用函数', insertText: 'map(${1:func}, ${2:iterable})' },
    { label: 'max', kind: f, detail: '内置函数', documentation: '最大值', insertText: 'max(${1:iterable})' },
    { label: 'min', kind: f, detail: '内置函数', documentation: '最小值', insertText: 'min(${1:iterable})' },
    { label: 'next', kind: f, detail: '内置函数', documentation: '迭代器下一项' },
    { label: 'object', kind: c, detail: '内置类', documentation: '所有类的基类' },
    { label: 'oct', kind: f, detail: '内置函数', documentation: '整数 → 八进制字符串' },
    { label: 'open', kind: f, detail: '内置函数', documentation: '打开文件', insertText: 'open("${1:path}")' },
    { label: 'ord', kind: f, detail: '内置函数', documentation: '字符 → Unicode 码点' },
    { label: 'pow', kind: f, detail: '内置函数', documentation: '幂运算' },
    { label: 'print', kind: f, detail: '内置函数', documentation: '打印到标准输出', insertText: 'print(${1:value})' },
    { label: 'property', kind: f, detail: '内置装饰器', documentation: '属性描述符' },
    { label: 'range', kind: c, detail: '内置类', documentation: '整数序列', insertText: 'range(${1:stop})' },
    { label: 'repr', kind: f, detail: '内置函数', documentation: '返回对象官方字符串表示' },
    { label: 'reversed', kind: f, detail: '内置函数', documentation: '反向迭代器', insertText: 'reversed(${1:seq})' },
    { label: 'round', kind: f, detail: '内置函数', documentation: '四舍五入', insertText: 'round(${1:number})' },
    { label: 'set', kind: c, detail: '内置类', documentation: '集合类型', insertText: 'set()' },
    { label: 'setattr', kind: f, detail: '内置函数', documentation: '设置对象属性' },
    { label: 'slice', kind: c, detail: '内置类', documentation: '切片对象' },
    { label: 'sorted', kind: f, detail: '内置函数', documentation: '排序并返回新列表', insertText: 'sorted(${1:iterable})' },
    { label: 'staticmethod', kind: f, detail: '内置装饰器', documentation: '声明静态方法' },
    { label: 'str', kind: c, detail: '内置类', documentation: '字符串类型' },
    { label: 'sum', kind: f, detail: '内置函数', documentation: '求和', insertText: 'sum(${1:iterable})' },
    { label: 'super', kind: f, detail: '内置函数', documentation: '调用父类方法' },
    { label: 'tuple', kind: c, detail: '内置类', documentation: '元组类型' },
    { label: 'type', kind: c, detail: '内置类', documentation: '返回对象类型 / 动态创建类' },
    { label: 'vars', kind: f, detail: '内置函数', documentation: '返回对象 __dict__' },
    { label: 'zip', kind: f, detail: '内置函数', documentation: '并行迭代多组可迭代对象', insertText: 'zip(${1:a}, ${2:b})' },
  ]
}

function buildPytestCompletions(): CompletionItemDef[] {
  const f = 1 // Function
  const c = 4 // Class
  const m = 0 // Method
  return [
    // pytest 核心
    { label: 'pytest', kind: f, detail: 'pytest 模块', documentation: 'Python 测试框架' },
    { label: 'fixture', kind: f, detail: 'pytest 夹具', documentation: '@pytest.fixture 装饰器，定义测试夹具', insertText: '@pytest.fixture\ndef ${1:name}():\n    ${2:return ...}' },
    { label: 'mark', kind: f, detail: 'pytest 标记', documentation: '@pytest.mark.xxx 装饰器，标记测试' },
    { label: 'raises', kind: f, detail: 'pytest 异常断言', documentation: '断言代码块抛出指定异常', insertText: 'with pytest.raises(${1:Exception}):\n    ${2:pass}' },
    { label: 'approx', kind: f, detail: 'pytest 近似比较', documentation: '近似相等断言（浮点数）' },
    { label: 'fail', kind: f, detail: 'pytest 强制失败', documentation: '强制执行失败', insertText: 'pytest.fail("${1:reason}")' },
    { label: 'skip', kind: f, detail: 'pytest 跳过', documentation: '跳过当前用例', insertText: 'pytest.skip("${1:reason}")' },
    { label: 'importorskip', kind: f, detail: 'pytest 按模块跳过', documentation: '模块不存在则跳过' },
    { label: 'xfail', kind: f, detail: 'pytest 标记预期失败', documentation: '@pytest.mark.xfail 标记已知失败' },
    { label: 'parametrize', kind: f, detail: 'pytest 参数化', documentation: '@pytest.mark.parametrize 参数化测试', insertText: '@pytest.mark.parametrize("${1:arg}", ${2:values})' },
    { label: 'warns', kind: f, detail: 'pytest 警告断言', documentation: '断言代码块抛出指定警告', insertText: 'with pytest.warns(${1:Warning}):\n    ${2:pass}' },
    { label: 'main', kind: f, detail: 'pytest 入口', documentation: 'pytest.main() 运行测试' },
    // pytest 常用断言
    { label: 'assertEqual', kind: m, detail: 'assert 相等', documentation: 'assert a == b' },
    { label: 'assertNotEqual', kind: m, detail: 'assert 不等', documentation: 'assert a != b' },
    { label: 'assertTrue', kind: m, detail: 'assert 为真', documentation: 'assert a is True' },
    { label: 'assertFalse', kind: m, detail: 'assert 为假', documentation: 'assert a is False' },
    { label: 'assertIs', kind: m, detail: 'assert 同对象', documentation: 'assert a is b' },
    { label: 'assertIsNone', kind: m, detail: 'assert 为None', documentation: 'assert a is None' },
    { label: 'assertIsNotNone', kind: m, detail: 'assert 非None', documentation: 'assert a is not None' },
    { label: 'assertIn', kind: m, detail: 'assert 成员', documentation: 'assert a in b' },
    { label: 'assertNotIn', kind: m, detail: 'assert 非成员', documentation: 'assert a not in b' },
    { label: 'assertIsInstance', kind: m, detail: 'assert 实例类型', documentation: 'assert isinstance(a, T)' },
    { label: 'assertRaises', kind: m, detail: 'assert 抛出异常', documentation: 'assert raises(Exception)' },
    { label: 'assertAlmostEqual', kind: m, detail: 'assert 近似相等', documentation: '浮点数近似相等' },
    { label: 'assertGreater', kind: m, detail: 'assert 大于', documentation: 'assert a > b' },
    { label: 'assertLess', kind: m, detail: 'assert 小于', documentation: 'assert a < b' },
    { label: 'assertRegex', kind: m, detail: 'assert 正则匹配', documentation: 'assert re.search(p, s)' },
  ]
}

function buildRequestsCompletions(): CompletionItemDef[] {
  const f = 1
  return [
    { label: 'requests', kind: f, detail: 'HTTP 库', documentation: 'Python HTTP 请求库' },
    { label: 'get', kind: f, detail: 'requests.get', documentation: 'GET 请求', insertText: 'requests.get("${1:url}")' },
    { label: 'post', kind: f, detail: 'requests.post', documentation: 'POST 请求', insertText: 'requests.post("${1:url}", json=${2:data})' },
    { label: 'put', kind: f, detail: 'requests.put', documentation: 'PUT 请求', insertText: 'requests.put("${1:url}", json=${2:data})' },
    { label: 'delete', kind: f, detail: 'requests.delete', documentation: 'DELETE 请求', insertText: 'requests.delete("${1:url}")' },
    { label: 'patch', kind: f, detail: 'requests.patch', documentation: 'PATCH 请求' },
    { label: 'head', kind: f, detail: 'requests.head', documentation: 'HEAD 请求' },
    { label: 'options', kind: f, detail: 'requests.options', documentation: 'OPTIONS 请求' },
    { label: 'Session', kind: f, detail: 'requests.Session', documentation: '会话对象（复用连接）' },
    { label: 'Response', kind: f, detail: 'requests.Response', documentation: '响应对象' },
    { label: 'status_code', kind: f, detail: 'Response.status_code', documentation: 'HTTP 状态码' },
    { label: 'json', kind: f, detail: 'Response.json()', documentation: '解析 JSON 响应', insertText: '${1:resp}.json()' },
    { label: 'text', kind: f, detail: 'Response.text', documentation: '响应文本内容' },
    { label: 'headers', kind: f, detail: '请求/响应头', documentation: 'HTTP 头部字典' },
  ]
}

function buildStdlibCompletions(): CompletionItemDef[] {
  const f = 1
  const c = 4
  return [
    // json
    { label: 'json', kind: f, detail: 'json 模块', documentation: 'JSON 编解码', insertText: 'import json' },
    { label: 'loads', kind: f, detail: 'json.loads()', documentation: 'JSON 字符串 → Python 对象', insertText: 'json.loads(${1:s})' },
    { label: 'dumps', kind: f, detail: 'json.dumps()', documentation: 'Python 对象 → JSON 字符串', insertText: 'json.dumps(${1:obj})' },
    { label: 'load', kind: f, detail: 'json.load()', documentation: '从文件读取 JSON' },
    { label: 'dump', kind: f, detail: 'json.dump()', documentation: '写入 JSON 到文件' },
    // os / path
    { label: 'os', kind: f, detail: 'os 模块', documentation: '操作系统接口', insertText: 'import os' },
    { label: 'os.path', kind: f, detail: 'os.path 模块', documentation: '路径操作' },
    { label: 'getenv', kind: f, detail: 'os.getenv()', documentation: '获取环境变量', insertText: 'os.getenv("${1:KEY}")' },
    { label: 'join', kind: f, detail: 'os.path.join()', documentation: '拼接路径', insertText: 'os.path.join(${1:a}, ${2:b})' },
    { label: 'exists', kind: f, detail: 'os.path.exists()', documentation: '路径是否存在' },
    // datetime
    { label: 'datetime', kind: f, detail: 'datetime 模块', documentation: '日期/时间处理', insertText: 'import datetime' },
    { label: 'datetime.now', kind: f, detail: 'datetime.now()', documentation: '当前时间', insertText: 'datetime.datetime.now()' },
    { label: 'timedelta', kind: c, detail: 'datetime.timedelta', documentation: '时间差' },
    // re
    { label: 're', kind: f, detail: 're 模块', documentation: '正则表达式', insertText: 'import re' },
    { label: 'search', kind: f, detail: 're.search()', documentation: '搜索正则匹配', insertText: 're.search(r"${1:pattern}", ${2:text})' },
    { label: 'match', kind: f, detail: 're.match()', documentation: '开头匹配正则' },
    { label: 'findall', kind: f, detail: 're.findall()', documentation: '查找所有匹配', insertText: 're.findall(r"${1:pattern}", ${2:text})' },
    { label: 'sub', kind: f, detail: 're.sub()', documentation: '替换正则匹配' },
    { label: 'compile', kind: f, detail: 're.compile()', documentation: '编译正则模式' },
    // random
    { label: 'random', kind: f, detail: 'random 模块', documentation: '随机数', insertText: 'import random' },
    { label: 'randint', kind: f, detail: 'random.randint()', documentation: '随机整数', insertText: 'random.randint(${1:a}, ${2:b})' },
    { label: 'choice', kind: f, detail: 'random.choice()', documentation: '随机选一个', insertText: 'random.choice(${1:seq})' },
    { label: 'shuffle', kind: f, detail: 'random.shuffle()', documentation: '随机打乱' },
    // time
    { label: 'time', kind: f, detail: 'time 模块', documentation: '时间相关', insertText: 'import time' },
    { label: 'sleep', kind: f, detail: 'time.sleep()', documentation: '等待秒数', insertText: 'time.sleep(${1:seconds})' },
    { label: 'time.time', kind: f, detail: 'time.time()', documentation: '当前时间戳', insertText: 'time.time()' },
    // string
    { label: 'string', kind: f, detail: 'string 模块', documentation: '字符串常量/工具' },
    // collections
    { label: 'collections', kind: f, detail: 'collections 模块', documentation: '容器数据类型', insertText: 'import collections' },
    { label: 'defaultdict', kind: c, detail: 'defaultdict', documentation: '带默认值的字典' },
    { label: 'OrderedDict', kind: c, detail: 'OrderedDict', documentation: '有序字典' },
    { label: 'Counter', kind: c, detail: 'Counter', documentation: '计数器' },
    // sys
    { label: 'sys', kind: f, detail: 'sys 模块', documentation: '系统参数与函数', insertText: 'import sys' },
    { label: 'argv', kind: f, detail: 'sys.argv', documentation: '命令行参数列表' },
    { label: 'exit', kind: f, detail: 'sys.exit()', documentation: '退出程序', insertText: 'sys.exit(${1:code})' },
    // math
    { label: 'math', kind: f, detail: 'math 模块', documentation: '数学函数', insertText: 'import math' },
    { label: 'math.ceil', kind: f, detail: 'math.ceil()', documentation: '向上取整' },
    { label: 'math.floor', kind: f, detail: 'math.floor()', documentation: '向下取整' },
    { label: 'math.sqrt', kind: f, detail: 'math.sqrt()', documentation: '平方根' },
    // typing
    { label: 'typing', kind: f, detail: 'typing 模块', documentation: '类型提示', insertText: 'import typing' },
    { label: 'Optional', kind: c, detail: 'typing.Optional', documentation: '可空类型' },
    { label: 'Union', kind: c, detail: 'typing.Union', documentation: '联合类型' },
    { label: 'List', kind: c, detail: 'typing.List', documentation: '列表类型注解' },
    { label: 'Dict', kind: c, detail: 'typing.Dict', documentation: '字典类型注解' },
    // pathlib
    { label: 'Path', kind: c, detail: 'pathlib.Path', documentation: '面向对象路径操作', insertText: 'Path("${1:path}")' },
  ]
}

// 合并所有静态补全项
const ALL_STATIC_COMPLETIONS: CompletionItemDef[] = [
  ...buildKeywordCompletions(),
  ...buildBuiltinCompletions(),
  ...buildPytestCompletions(),
  ...buildRequestsCompletions(),
  ...buildStdlibCompletions(),
]

// =============================================================
// Pyodide 懒加载：用于成员访问补全（如 requests. → get, post ...）
// =============================================================

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js'

interface PyodideAPI {
  runPythonAsync(code: string): Promise<any>
  loadPackagesFromImports(code: string): Promise<any>
}

let pyodidePromise: Promise<PyodideAPI> | null = null
let pyodideLoadStarted = false

function loadPyodide(): Promise<PyodideAPI> {
  if (pyodidePromise) return pyodidePromise
  pyodideLoadStarted = true

  pyodidePromise = new Promise<PyodideAPI>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = PYODIDE_URL
    script.onload = async () => {
      try {
        const pyodide = await (window as any).loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/',
        })
        resolve(pyodide as PyodideAPI)
      } catch (e) {
        pyodidePromise = null // 允许下次重试
        reject(e)
      }
    }
    script.onerror = () => {
      pyodidePromise = null
      reject(new Error('Pyodide CDN 加载失败'))
    }
    document.head.appendChild(script)
  })

  return pyodidePromise
}

/**
 * 判断 Pyodide 是否已开始加载
 */
function isPyodideLoading(): boolean {
  return pyodideLoadStarted && !pyodidePromise
}

/** 获取成员补全（异步，依赖 Pyodide） */
async function getMemberCompletions(
  expression: string,
  mkItem: (def: CompletionItemDef) => any,
): Promise<any[]> {
  try {
    const pyodide = await loadPyodide()

    // 尝试 import 该表达式，获取其成员
    const code = `__import__('${expression}') if '${expression}' != '__builtins__' else __builtins__`
    const result = pyodide.runPythonAsync(`try:
    mod = ${code}
    names = [n for n in dir(mod) if not n.startswith('_')]
    ','.join(names)
except:
    ''`)

    const members: string = typeof result === 'string' ? result : await result
    if (!members) return []

    return members.split(',').map((name) =>
      mkItem({
        label: name,
        kind: 0, // Method
        detail: `${expression}.${name}`,
        documentation: `${expression}.${name}`,
      }),
    )
  } catch {
    return []
  }
}

// =============================================================
// 导出：注册 Monaco 补全提供者
// =============================================================

export function registerPythonCompletions(monaco: any): void {
  const Kind = monaco.languages.CompletionItemKind

  // 辅助函数：把 CompletionItemDef 转为 Monaco CompletionItem
  const buildItem = (def: CompletionItemDef) => ({
    label: def.label,
    kind: def.kind,
    detail: def.detail,
    documentation: def.documentation,
    insertText: def.insertText || def.label,
    insertTextRules: def.insertText
      ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      : undefined,
  })

  // ---- 提供者 1：静态补全（所有字符触发） ----
  const staticItems = ALL_STATIC_COMPLETIONS.map(buildItem)

  monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems: () => ({
      suggestions: staticItems,
    }),
  })

  // ---- 提供者 2：成员访问补全（. 触发，依赖 Pyodide） ----
  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.'],
    provideCompletionItems: async (model: any, position: any) => {
      // 提取 . 前面的 token
      const word = model.getWordAtPosition({
        lineNumber: position.lineNumber,
        column: position.column - 1,
      })
      const expr = word?.word || ''
      if (!expr) return { suggestions: [] }

      // 检查是否在注释或字符串中（简单判断：该行是否以 # 开头）
      const lineContent = model.getLineContent(position.lineNumber)
      const beforeDot = lineContent.substring(0, position.column - 1)
      if (beforeDot.includes('#') && !beforeDot.includes('"') && !beforeDot.includes("'")) {
        return { suggestions: [] }
      }

      // 先用静态数据快速填充
      const staticMembers = EXPR_MEMBER_MAP[expr]
      const staticSuggestions = staticMembers
        ? staticMembers.map((name) =>
            buildItem({
              label: name,
              kind: 0,
              detail: `${expr}.${name}`,
              documentation: `${expr}.${name}`,
            }),
          )
        : []

      // 异步获取 Pyodide 成员补全（限时 2 秒，超时则仅用静态结果）
      try {
        const pyodideItems = await Promise.race([
          getMemberCompletions(expr, buildItem),
          new Promise<any[]>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000),
          ),
        ])
        // 合并去重
        const seen = new Set(staticSuggestions.map((s: any) => s.label))
        const merged = [...staticSuggestions]
        for (const item of pyodideItems) {
          if (!seen.has(item.label)) {
            merged.push(item)
          }
        }
        return { suggestions: merged }
      } catch {
        return { suggestions: staticSuggestions }
      }
    },
  })
}

// 常用模块成员静态映射（Pyodide 还没加载完时也能快速补全）
const EXPR_MEMBER_MAP: Record<string, string[]> = {
  requests: ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'Session', 'Response', 'codes', 'exceptions'],
  json: ['loads', 'dumps', 'load', 'dump', 'JSONDecodeError', 'JSONEncoder'],
  os: ['getenv', 'environ', 'listdir', 'path', 'makedirs', 'remove', 'rename', 'walk', 'getcwd', 'chdir', 'name', 'sep'],
  'os.path': ['join', 'exists', 'isfile', 'isdir', 'dirname', 'basename', 'splitext', 'abspath', 'getsize'],
  re: ['search', 'match', 'findall', 'sub', 'split', 'compile', 'IGNORECASE', 'MULTILINE', 'DOTALL'],
  datetime: ['datetime', 'date', 'time', 'timedelta', 'timezone', 'tzinfo'],
  random: ['randint', 'choice', 'shuffle', 'random', 'seed', 'uniform', 'sample'],
  time: ['sleep', 'time', 'ctime', 'localtime', 'strftime', 'strptime'],
  string: ['ascii_letters', 'ascii_lowercase', 'ascii_uppercase', 'digits', 'hexdigits', 'octdigits', 'punctuation', 'whitespace', 'printable', 'Formatter', 'Template'],
  sys: ['argv', 'exit', 'path', 'version', 'platform', 'stdout', 'stderr', 'stdin', 'modules'],
  math: ['ceil', 'floor', 'sqrt', 'pow', 'sin', 'cos', 'tan', 'pi', 'e', 'log', 'log10', 'factorial', 'gcd', 'isclose'],
  collections: ['defaultdict', 'OrderedDict', 'Counter', 'deque', 'namedtuple', 'ChainMap'],
  typing: ['Optional', 'Union', 'List', 'Dict', 'Tuple', 'Set', 'Any', 'Callable', 'TypeVar', 'Literal'],
  pathlib: ['Path', 'PurePath'],
  pytest: ['fixture', 'mark', 'raises', 'approx', 'fail', 'skip', 'importorskip', 'xfail', 'parametrize', 'warns', 'main', 'exit', 'deprecated_call'],
  str: ['upper', 'lower', 'title', 'strip', 'lstrip', 'rstrip', 'split', 'rsplit', 'join', 'replace', 'find', 'rfind', 'index', 'startswith', 'endswith', 'isalpha', 'isdigit', 'isalnum', 'islower', 'isupper', 'format', 'encode', 'count', 'partition', 'rpartition', 'capitalize', 'swapcase'],
  list: ['append', 'extend', 'insert', 'remove', 'pop', 'clear', 'index', 'count', 'sort', 'reverse', 'copy'],
  dict: ['keys', 'values', 'items', 'get', 'pop', 'popitem', 'update', 'setdefault', 'clear', 'copy', 'fromkeys'],
  set: ['add', 'remove', 'discard', 'pop', 'clear', 'union', 'intersection', 'difference', 'symmetric_difference', 'update', 'isdisjoint', 'issubset', 'issuperset', 'copy'],
  tuple: ['count', 'index'],
  Response: ['status_code', 'text', 'json', 'content', 'headers', 'cookies', 'url', 'ok', 'raise_for_status', 'elapsed', 'encoding'],
}
