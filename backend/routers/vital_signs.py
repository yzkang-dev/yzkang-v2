"""
颐智康养 - 生命体征记录接口
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import get_db, VitalSigns, Elder
from routers.auth_router import get_current_user
from schemas import VitalSignsOut, VitalSignsCreate

router = APIRouter(prefix="/api/vital-signs", tags=["生命体征"])


@router.get("/elder/{elder_id}", response_model=list[VitalSignsOut], summary="获取老人生命体征记录")
def list_vital_signs(
    elder_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """返回指定老人最近的生命体征记录（按时间倒序）"""
    elder = db.query(Elder).filter(Elder.id == elder_id).first()
    if not elder:
        raise HTTPException(404, "老人不存在")

    return (
        db.query(VitalSigns)
        .filter(VitalSigns.elder_id == elder_id)
        .order_by(VitalSigns.record_time.desc())
        .limit(100)
        .all()
    )


@router.get("/", response_model=list[VitalSignsOut], summary="查询生命体征列表")
def search_vital_signs(
    elder_id: int | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """通用查询：可选按老人ID过滤，返回全部或指定老人的体征记录"""
    q = db.query(VitalSigns)
    if elder_id is not None:
        q = q.filter(VitalSigns.elder_id == elder_id)
    return q.order_by(VitalSigns.record_time.desc()).limit(200).all()


@router.post("/", response_model=VitalSignsOut, summary="记录生命体征")
def create_vital_sign(
    data: VitalSignsCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """为指定老人记录一次生命体征数据"""
    elder = db.query(Elder).filter(Elder.id == data.elder_id).first()
    if not elder:
        raise HTTPException(404, "老人不存在")

    vs = VitalSigns(
        elder_id=data.elder_id,
        nurse_id=current_user.id,
        measurement_type=data.measurement_type,
        temperature=data.temperature,
        heart_rate=data.heart_rate,
        blood_pressure_systolic=data.blood_pressure_systolic,
        blood_pressure_diastolic=data.blood_pressure_diastolic,
        blood_sugar=data.blood_sugar,
        oxygen_saturation=data.oxygen_saturation,
        weight=data.weight,
        notes=data.notes,
    )
    db.add(vs)
    db.commit()
    db.refresh(vs)
    return vs


@router.get("/{vital_sign_id}", response_model=VitalSignsOut, summary="获取单条体征详情")
def get_vital_sign(
    vital_sign_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """获取指定体征记录的详细信息"""
    vs = db.query(VitalSigns).filter(VitalSigns.id == vital_sign_id).first()
    if not vs:
        raise HTTPException(404, "体征记录不存在")
    return vs
