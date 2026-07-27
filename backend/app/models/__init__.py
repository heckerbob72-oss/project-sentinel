"""Aggregate model imports so `Base.metadata` sees every table."""
from .audit import ActivityLog, AgentRun, AuditLog, Conversation, Setting
from .document import Document, DocumentChunk, DocumentSource
from .knowledge import KnowledgeEdge, KnowledgeNode, LessonsLearned, PortfolioProject
from .project import Project, ProjectDNA, ProjectMethod, ProjectTemplate
from .report import ActionItem, MeetingMinutes, Report
from .risk import Mitigation, RecoveryPlan, Risk, RiskRule
from .simulation import HealthScore, Simulation, SimulationResult
from .team import Availability, Member, MemberSkill, Skill, Team
from .user import Permission, Role, User
from .work import Allocation, Milestone, Task, TaskDependency, WBSItem

__all__ = [
    "User", "Role", "Permission",
    "Project", "ProjectDNA", "ProjectMethod", "ProjectTemplate",
    "Team", "Member", "Skill", "MemberSkill", "Availability",
    "WBSItem", "Task", "TaskDependency", "Allocation", "Milestone",
    "Risk", "RiskRule", "Mitigation", "RecoveryPlan",
    "Document", "DocumentChunk", "DocumentSource",
    "Report", "MeetingMinutes", "ActionItem",
    "Simulation", "SimulationResult", "HealthScore",
    "KnowledgeNode", "KnowledgeEdge", "LessonsLearned", "PortfolioProject",
    "Conversation", "AgentRun", "ActivityLog", "AuditLog", "Setting",
]
