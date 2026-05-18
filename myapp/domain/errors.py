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
        
class InvalidScheduleRequestParams(DomainError):
    def __init__(self, detail: str = "invalid schedule request params"):
        super().__init__(detail)


class InvalidScheduleDayParams(InvalidScheduleRequestParams):
    def __init__(self, detail: str = "invalid schedule day params"):
        super().__init__(detail)
        
class ScheduleEventMoveError(DomainError):
    """
    スケジュールイベント移動処理の基底例外。
    """
    pass


class ScheduleEventMoveNotFound(ScheduleEventMoveError):
    def __init__(self, detail: str = "schedule event move target not found"):
        super().__init__(detail)


class ScheduleApproverNotFound(ScheduleEventMoveError):
    def __init__(self, detail: str = "schedule approver not found"):
        super().__init__(detail)
        
class InvalidScheduleEventRetractParams(DomainError):
    def __init__(self, detail: str = "invalid schedule event retract params"):
        super().__init__(detail)


class ScheduleEventRetractNotFound(DomainError):
    def __init__(self, detail: str = "schedule event retract target not found"):
        super().__init__(detail)
    
class ScheduleEventRetractNotAllowed(DomainError):
    def __init__(self, detail: str = "schedule event retract not allowed"):
        super().__init__(detail)

class ScheduleBulkRegistrationError(DomainError):
    """
    スケジュール一括登録処理の基底例外。
    """
    pass


class InvalidScheduleBulkRegistrationParams(ScheduleBulkRegistrationError):
    def __init__(self, detail: str = "invalid schedule bulk registration params"):
        super().__init__(detail)


class ScheduleBulkRegistrationMemberNotFound(ScheduleBulkRegistrationError):
    def __init__(self, detail: str = "schedule bulk registration member not found"):
        super().__init__(detail)


class ScheduleBulkRegistrationShiftPatternNotFound(ScheduleBulkRegistrationError):
    def __init__(self, detail: str = "schedule bulk registration shift pattern not found"):
        super().__init__(detail)