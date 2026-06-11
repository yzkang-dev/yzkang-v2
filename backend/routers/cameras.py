"""
颐智康养 - 视频监控/摄像头管理接口
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import get_db, Camera
from routers.auth_router import get_current_user
from schemas import CameraOut, CameraCreate

router = APIRouter(prefix="/api/cameras", tags=["视频监控"])


@router.get("/", response_model=list[CameraOut], summary="获取摄像头列表")
def list_cameras(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """返回所有摄像头"""
    return db.query(Camera).all()


@router.post("/", response_model=CameraOut, summary="添加摄像头")
def create_camera(
    data: CameraCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """注册新摄像头设备"""
    cam = Camera(
        name=data.name,
        location=data.location,
        elder_id=data.elder_id,
        rtsp_url=data.rtsp_url,
        snapshot_url=data.snapshot_url,
        is_active=data.is_active,
        status="offline",
    )
    db.add(cam)
    db.commit()
    db.refresh(cam)
    return cam


@router.put("/{camera_id}", response_model=CameraOut, summary="更新摄像头")
def update_camera(
    camera_id: int,
    data: CameraCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """修改摄像头名称、位置或推流地址"""
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(404, "摄像头不存在")
    cam.name = data.name
    cam.location = data.location
    cam.rtsp_url = data.rtsp_url
    db.commit()
    db.refresh(cam)
    return cam


@router.delete("/{camera_id}", summary="删除摄像头")
def delete_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """删除指定摄像头"""
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(404, "摄像头不存在")
    db.delete(cam)
    db.commit()
    return {"ok": True}
