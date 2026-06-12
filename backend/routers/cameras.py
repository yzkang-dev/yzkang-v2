"""视频监控 - 摄像头管理 & 告警"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import get_db
from auth import get_current_user
from models import User, Camera, CameraAlert, Elder
from schemas import CameraCreate, CameraUpdate, CameraOut, CameraAlertOut

router = APIRouter(prefix="/api/cameras", tags=["视频监控"])

# ⚠️ 固定路径必须在参数路径之前定义（FastAPI 路由匹配顺序）


# ==================== 告警管理（固定路径，必须在前面） ====================

@router.get("/alerts", response_model=list[CameraAlertOut], summary="摄像头告警列表")
def list_alerts(
    handled: bool | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(CameraAlert)
    if handled is not None:
        q = q.filter(CameraAlert.is_handled == handled)
    alerts = q.order_by(CameraAlert.created_at.desc()).limit(200).all()
    result = []
    for a in alerts:
        cam = db.query(Camera).filter(Camera.id == a.camera_id).first()
        elder = db.query(Elder).filter(Elder.id == a.elder_id).first() if a.elder_id else None
        result.append(CameraAlertOut(
            id=a.id, camera_id=a.camera_id,
            camera_name=cam.name if cam else None,
            elder_id=a.elder_id,
            elder_name=elder.name if elder else None,
            alert_type=a.alert_type, severity=a.severity,
            description=a.description, snapshot_url=a.snapshot_url,
            is_handled=a.is_handled, created_at=a.created_at,
        ))
    return result


@router.put("/alerts/{alert_id}/handle", summary="处理告警")
def handle_alert(alert_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    alert = db.query(CameraAlert).filter(CameraAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(404, "告警不存在")
    from datetime import datetime, timezone
    alert.is_handled = True
    alert.handled_by = current_user.id
    alert.handled_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


# ==================== 摄像头 CRUD ====================

@router.get("/", response_model=list[CameraOut], summary="摄像头列表")
def list_cameras(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cams = db.query(Camera).order_by(Camera.created_at.desc()).all()
    result = []
    for cam in cams:
        elder = db.query(Elder).filter(Elder.id == cam.elder_id).first() if cam.elder_id else None
        result.append(CameraOut(
            id=cam.id, name=cam.name, location=cam.location,
            elder_id=cam.elder_id, elder_name=elder.name if elder else None,
            status=cam.status, is_active=cam.is_active, created_at=cam.created_at,
        ))
    return result


@router.post("/", response_model=CameraOut, summary="添加摄像头", status_code=201)
def create_camera(body: CameraCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cam = Camera(
        name=body.name, location=body.location, elder_id=body.elder_id,
        rtsp_url=body.rtsp_url, snapshot_url=body.snapshot_url,
        status="offline", is_active=body.is_active,
    )
    db.add(cam)
    db.commit()
    db.refresh(cam)
    elder = db.query(Elder).filter(Elder.id == cam.elder_id).first() if cam.elder_id else None
    return CameraOut(
        id=cam.id, name=cam.name, location=cam.location,
        elder_id=cam.elder_id, elder_name=elder.name if elder else None,
        status=cam.status, is_active=cam.is_active, created_at=cam.created_at,
    )


# ==================== 参数化路径（固定路径之后） ====================

@router.get("/{cam_id}/snapshot", summary="获取摄像头快照")
def get_snapshot(cam_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cam = db.query(Camera).filter(Camera.id == cam_id).first()
    if not cam:
        raise HTTPException(404, "摄像头不存在")
    return {"snapshot_url": cam.snapshot_url or "", "camera_name": cam.name}


@router.put("/{cam_id}", response_model=CameraOut, summary="编辑摄像头")
def update_camera(cam_id: int, body: CameraUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cam = db.query(Camera).filter(Camera.id == cam_id).first()
    if not cam:
        raise HTTPException(404, "摄像头不存在")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(cam, k, v)
    db.commit()
    db.refresh(cam)
    elder = db.query(Elder).filter(Elder.id == cam.elder_id).first() if cam.elder_id else None
    return CameraOut(
        id=cam.id, name=cam.name, location=cam.location,
        elder_id=cam.elder_id, elder_name=elder.name if elder else None,
        status=cam.status, is_active=cam.is_active, created_at=cam.created_at,
    )


@router.delete("/{cam_id}", summary="删除摄像头")
def delete_camera(cam_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cam = db.query(Camera).filter(Camera.id == cam_id).first()
    if not cam:
        raise HTTPException(404, "摄像头不存在")
    db.delete(cam)
    db.commit()
    return {"ok": True}
