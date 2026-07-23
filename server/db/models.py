from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
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
    created_at = Column(DateTime, default=func.now())

    batch = relationship("TestBatch", back_populates="cases")