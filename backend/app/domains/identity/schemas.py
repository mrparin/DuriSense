from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.domains.identity.models import AccountStatus, ActivationMethod, RoleCode


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=32)
    password: str = Field(min_length=10, max_length=128)
    password_confirmation: str
    farm_name: str = Field(min_length=2, max_length=200)
    accept_terms: bool

    @model_validator(mode="after")
    def validate_registration(self):
        if self.password != self.password_confirmation:
            raise ValueError("passwords do not match")
        if not any(char.isalpha() for char in self.password) or not any(char.isdigit() for char in self.password):
            raise ValueError("password must contain letters and numbers")
        if not self.accept_terms:
            raise ValueError("terms must be accepted")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    otp: str | None = Field(default=None, pattern=r"^\d{6}$")
    recovery_code: str | None = Field(default=None, min_length=8, max_length=32)


class MfaSetupResponse(BaseModel):
    challenge_token: str
    secret: str
    provisioning_uri: str


class MfaConfirmRequest(BaseModel):
    challenge_token: str = Field(min_length=20, max_length=256)
    otp: str = Field(pattern=r"^\d{6}$")


class MfaRecoveryCodesRequest(BaseModel):
    otp: str = Field(pattern=r"^\d{6}$")


class MfaRecoveryCodesResponse(BaseModel):
    recovery_codes: list[str]


class EmailRequest(BaseModel):
    email: EmailStr


class TokenRequest(BaseModel):
    token: str = Field(min_length=20, max_length=256)


class ResetPasswordRequest(TokenRequest):
    password: str = Field(min_length=10, max_length=128)
    password_confirmation: str

    @model_validator(mode="after")
    def validate_password(self):
        if self.password != self.password_confirmation:
            raise ValueError("passwords do not match")
        if not any(char.isalpha() for char in self.password) or not any(char.isdigit() for char in self.password):
            raise ValueError("password must contain letters and numbers")
        return self


class AdminDecisionRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class RoleAssignmentRequest(BaseModel):
    roles: list[RoleCode] = Field(min_length=1)
    reason: str = Field(min_length=3, max_length=500)


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    phone: str | None = Field(default=None, max_length=32)
    timezone: str = Field(default="Asia/Bangkok", max_length=64)


class TenantSummary(BaseModel):
    id: UUID
    name: str
    role: RoleCode


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    phone: str | None
    timezone: str
    status: AccountStatus
    activation_method: ActivationMethod | None
    email_verified_at: datetime | None
    admin_approved_at: datetime | None
    roles: list[RoleCode]
    tenants: list[TenantSummary]


class AuthResponse(BaseModel):
    user: UserResponse
    csrf_token: str


class RegistrationResponse(BaseModel):
    status: AccountStatus
    message: str
    verification_token: str | None = None


class GenericResponse(BaseModel):
    message: str
    development_token: str | None = None


class RegistrationStatusResponse(BaseModel):
    status: AccountStatus | None
    message: str


class PendingUserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    phone: str | None
    status: AccountStatus
    email_verified_at: datetime | None
    created_at: datetime


class ErrorBody(BaseModel):
    code: str
    message: str
    field_errors: dict[str, list[str]] | None = None
    request_id: str
