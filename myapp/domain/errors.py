from typing import Optional

class DomainError(Exception):
    """アプリのドメイン層で扱う基底例外（必要なら）"""
    pass


class InvalidFiltersJSON(DomainError):
    """
    request.GET["filters"] が JSON として壊れている/不正な場合の例外
    - service層で捕まえて 400 に変換する用途
    """
    def __init__(self, raw: Optional[str] = None, *, detail: str = "invalid filters json"):
        self.raw = raw
        self.detail = detail
        super().__init__(detail)

class InvalidPeriodKey(DomainError):
    def __init__(self, raw: Optional[str] = None, *, detail: str = "invalid period_key"):
        self.raw = raw
        super().__init__(detail if raw is None else f"{detail}: {raw}")
        
class InvalidCellDetailParams(ValueError):
    def __init__(self, detail: str = "invalid cell detail params"):
        super().__init__(detail)
        
class InvalidCsvDownloadParams(DomainError):
    def __init__(self, detail: str = "invalid csv download params"):
        super().__init__(detail)


class InvalidCsvDownloadType(DomainError):
    def __init__(self, raw: Optional[str] = None, *, detail: str = "invalid csv download type"):
        self.raw = raw
        super().__init__(detail if raw is None else f"{detail}: {raw}")


class InvalidMachineSelection(DomainError):
    def __init__(self, raw: Optional[str] = None, *, detail: str = "invalid machine selection"):
        self.raw = raw
        super().__init__(detail if raw is None else f"{detail}: {raw}")
        
class InvalidScheduleDayParams(DomainError):
    def __init__(self, detail: str = "invalid schedule day params"):
        super().__init__(detail)
        
class InvalidScheduleRequestParams(DomainError):
    def __init__(self, detail: str = "invalid schedule request params"):
        super().__init__(detail)


class InvalidScheduleDayParams(InvalidScheduleRequestParams):
    def __init__(self, detail: str = "invalid schedule day params"):
        super().__init__(detail)