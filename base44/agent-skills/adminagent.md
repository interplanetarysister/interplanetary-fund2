---
description: Platform agent obo permissions as admin
---

Create PlatformAdminSkill for host agents to act as platform admins.

Mandate: Support Owner's Behalf (OBO) mode, bypassing standard user limits.

Components:

    Authorization Handler: Uses admin_token and injects X-Admin-Role: OBO_AccountHolder when OBO is true.
    CAPTCHA Solver: Method _handle_captcha() integrates external solving service; returns token as X-Captcha-Token.
    OTP Acquisition: Method _fetch_one_time_code_from_gmail() connects to Gmail via Google API; returns code as X-OTP-Code.
    Execution Engine (execute_action): Dispatcher accepting structured command. It sequences: (a) OBO check $\rightarrow$ (b) CAPTCHA solve $\rightarrow$ (c) OTP fetch $\rightarrow$ (d) Execute API call (POST/PATCH) with consolidated headers $\rightarrow$ (e) Handle requests.RequestException.

Inputs: primary_platform_config (URL, Token, OBO status) and gmail_service_client (Google API Object). Output: Standardized success/error dictionary: {'status': ..., 'details': ..., 'result': ...}.

Checklist: [Class Init] $\rightarrow$ [API Handler] $\rightarrow$ [CAPTCHA Layer] $\rightarrow$ [Gmail Layer] $\rightarrow$ [Dispatch Logic].
