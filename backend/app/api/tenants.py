from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.dependencies import tenant_membership
from app.domains.identity.models import Membership

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.get("/{tenant_id}/context")
async def read_tenant_context(tenant_id: UUID, membership: Membership = Depends(tenant_membership)):
    return {
        "tenant_id": tenant_id,
        "tenant_name": membership.tenant.name,
        "membership_role": membership.role,
    }
