from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

# ---------- 批次表 ----------
class TestBatch(Base):
    __tablename__ = "test_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String(100), nullable=False)
    start_time = Column(DateTime, default=func.now())
    end_time = Column(DateTime, nullable=True)
    total_cases = Column(Integer, default=0)
    passed = Column(Integer, default=0)
    failed = Column(Integer, default=0)

    cases = relationship("CaseRun", back_populates="batch")

# ---------- 用例结果表 ----------
class CaseRun(Base):
    __tablename__ = "case_runs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("test_batches.id"), nullable=True)
    case_name = Column(String(255), nullable=False)
    case_path = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False)
    duration = Column(Integer)
    total = Column(Integer, default=0)
    passed = Column(Integer, default=0)
    failed = Column(Integer, default=0)
    skipped = Column(Integer, default=0)
    report_url = Column(String(500), default="")
    error_message = Column(Text, default="")  # 失败用例的异常/断言信息
    category_id = Column(Integer, nullable=True)  # 关联测试用例目录
    category_name = Column(String(255), nullable=True)  # 执行时快照目录名称
    created_at = Column(DateTime, default=func.now())

    batch = relationship("TestBatch", back_populates="cases")

# ---------- 测试用例目录表 ----------
class TestCaseCategory(Base):
    __tablename__ = "test_case_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    is_system = Column(Boolean, default=False)   # 系统目录（如回收站），不可删除/重命名
    is_deleted = Column(Boolean, default=False)  # 软删除标记
    created_at = Column(DateTime, default=func.now())

    cases = relationship("TestCase", back_populates="category")

# ---------- 测试用例管理表 ----------
class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("test_case_categories.id"), nullable=True)
    name = Column(String(255), unique=True, nullable=False)
    script_content = Column(Text, nullable=False)
    original_category_id = Column(Integer, nullable=True)  # 软删除前的原目录ID，恢复时使用
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    category = relationship("TestCaseCategory", back_populates="cases")

# ---------- 平台配置表 ----------
class PlatformConfig(Base):
    __tablename__ = "platform_config"

    key = Column(String(100), primary_key=True)
    value = Column(Text, default="")