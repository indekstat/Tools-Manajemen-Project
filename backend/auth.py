from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
import models

SECRET_KEY = "my_super_secret_key_for_this_project_tracking"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 1 day

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(request: Request, token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Token"},
    )

    if not token and request:
        auth_header = request.headers.get("Authorization")
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() in ["bearer", "token"]:
                token = parts[1]

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username:
            clean_u = username.strip().lower()
            user = db.query(models.User).filter(
                (models.User.username == clean_u) | 
                (models.User.nama.ilike(f"%{clean_u}%"))
            ).first()
            if user:
                return user
    except JWTError:
        pass

    raise credentials_exception

def check_role(required_roles: list):
    def role_checker(current_user: models.User = Depends(get_current_user)):
        user_role = current_user.role or ""
        user_level = (current_user.level or "").upper()
        if user_role in ["Superadmin", "Management"] or user_level in ["CHIEF", "HEAD"]:
            return current_user

        allowed_roles = set(required_roles)
        # Add role aliases for seamless compatibility
        if "IR" in allowed_roles or "Institutional Relationship" in allowed_roles:
            allowed_roles.update(["IR", "Institutional Relationship"])
        if "Gov" in allowed_roles or "Government" in allowed_roles:
            allowed_roles.update(["Gov", "Government"])
        if "Pol" in allowed_roles or "Political Science" in allowed_roles or "Politics" in allowed_roles:
            allowed_roles.update(["Pol", "Political Science", "Politics"])

        if user_role not in allowed_roles and user_role != "Admin":
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return current_user
    return role_checker
