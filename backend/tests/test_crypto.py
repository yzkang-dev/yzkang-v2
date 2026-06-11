"""
加密模块单元测试：敏感数据加解密
"""
import pytest
import os
from utils.crypto import encrypt, decrypt, EncryptedString, KEY


class TestEncryptDecrypt:
    """测试加解密核心函数"""

    def test_round_trip_id_card(self):
        """身份证号加解密往返"""
        plain = "110101199001011234"
        enc = encrypt(plain)
        assert enc != plain
        assert enc.startswith("$AES$") is False  # 密文是 Base64
        dec = decrypt(enc)
        assert dec == plain

    def test_round_trip_phone(self):
        """手机号加解密往返"""
        plain = "13800138000"
        enc = encrypt(plain)
        dec = decrypt(enc)
        assert dec == plain

    def test_round_trip_chinese(self):
        """中文文本加解密"""
        plain = "张三的妻子"
        enc = encrypt(plain)
        dec = decrypt(enc)
        assert dec == plain

    def test_different_encryption_each_time(self):
        """相同明文两次加密结果不同（nonce 随机）"""
        plain = "110101199001011234"
        e1 = encrypt(plain)
        e2 = encrypt(plain)
        assert e1 != e2
        assert decrypt(e1) == decrypt(e2) == plain

    def test_empty_string(self):
        """空字符串不加密"""
        assert encrypt("") == ""
        assert decrypt("") == ""

    def test_none_value(self):
        """None 直接返回"""
        assert encrypt(None) is None
        assert decrypt(None) is None

    def test_plaintext_backward_compat(self):
        """明文数据（旧数据）解密时直接返回原文"""
        plain = "13800138000"
        assert decrypt(plain) == plain
        plain_id = "44010119851212003X"
        assert decrypt(plain_id) == plain_id

    def test_corrupted_data_fallback(self):
        """损坏的密文解密失败时返回原文"""
        garbage = "这不是合法密文#@!"
        result = decrypt(garbage)
        assert result == garbage  # 兜底返回原文


class TestEncryptedStringType:
    """测试 SQLAlchemy 自定义列类型"""

    def test_bind_param_encrypts(self):
        """写入数据库前应加密"""
        col = EncryptedString(18)
        result = col.process_bind_param("110101199001011234", None)
        assert result is not None
        assert result != "110101199001011234"

    def test_bind_param_none(self):
        """None 不加密"""
        col = EncryptedString(18)
        assert col.process_bind_param(None, None) is None

    def test_result_value_decrypts(self):
        """读出数据库后应解密"""
        col = EncryptedString(18)
        encrypted = encrypt("13800138000")
        result = col.process_result_value(encrypted, None)
        assert result == "13800138000"

    def test_result_value_plaintext(self):
        """旧明文数据直接返回"""
        col = EncryptedString(18)
        result = col.process_result_value("13800138000", None)
        assert result == "13800138000"

    def test_result_value_none(self):
        col = EncryptedString(18)
        assert col.process_result_value(None, None) is None

    def test_column_length_expanded(self):
        """加密后列长度应被扩展（防止数据截断）"""
        col = EncryptedString(18)
        # impl 是 String，长度应大于原始长度
        assert col.impl.length > 18
