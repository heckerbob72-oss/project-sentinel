"""Team, member, skill, and availability models."""
from __future__ import annotations

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base
from .base import SoftDeleteMixin, TimestampMixin


class Team(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")

    members: Mapped[list["Member"]] = relationship(back_populates="team")


class Member(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "members"

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(255), default="")
    role: Mapped[str] = mapped_column(String(80), default="Contributor")
    capacity_hours: Mapped[float] = mapped_column(Float, default=40.0)

    team: Mapped[Team] = relationship(back_populates="members")
    skills: Mapped[list["MemberSkill"]] = relationship(back_populates="member")


class Skill(Base, TimestampMixin):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(80), default="general")


class MemberSkill(Base, TimestampMixin):
    __tablename__ = "member_skills"

    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), index=True)
    proficiency: Mapped[int] = mapped_column(Integer, default=3)  # 1..5

    member: Mapped[Member] = relationship(back_populates="skills")
    skill: Mapped[Skill] = relationship()


class Availability(Base, TimestampMixin):
    __tablename__ = "availability"

    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id", ondelete="CASCADE"), index=True)
    week_starting: Mapped[str] = mapped_column(String(20))
    available_hours: Mapped[float] = mapped_column(Float, default=40.0)
    notes: Mapped[str] = mapped_column(Text, default="")
