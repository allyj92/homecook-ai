package com.homecook.ai_recipe.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailSender;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MailService {
    private final MailSender mailSender;

    @Value("${spring.mail.host:}")
    private String smtpHost;

    @Value("${spring.mail.username:}")
    private String smtpUser;

    @Value("${mail.from:no-reply@recipfree.com}")
    private String from;

    @Value("${mail.reset-subject:[RecipFree] 비밀번호 재설정 링크}")
    private String resetSubject;

    /** SMTP 가 제대로 설정된 경우에만 실제 발송 */
    private boolean canSend() {
        return notBlank(smtpHost) && notBlank(smtpUser) && notBlank(from);
    }
    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }

    public void sendPasswordReset(String to, String resetLink) {
        String subject = "[RecipFree] 비밀번호 재설정 안내";
        String body = """
                안녕하세요,

                아래 링크를 눌러 비밀번호를 재설정하세요.
                %s

                링크는 일정 시간 후 만료됩니다.

                감사합니다.
                - RecipFree
                """.formatted(resetLink);

        sendOrLog(to, subject, body, "[DEV][PasswordReset]");
    }

    public void sendFindId(String to, String emailShown) {
        String subject = "[RecipFree] 아이디 안내";
        String body = "회원님의 로그인 이메일은 다음과 같습니다:\n\n" + emailShown + "\n\n- RecipFree";
        sendOrLog(to, subject, body, "[DEV][FindId]");
    }

    private void sendOrLog(String to, String subject, String body, String devTag) {
        if (!canSend()) {
            System.out.println(devTag + " to=" + to + "\nSUBJECT=" + subject + "\n" + body);
            return;
        }
        try {
            var msg = new SimpleMailMessage();
            msg.setFrom(from);     // 예: "RecipFree <yourgmail@gmail.com>"
            msg.setTo(to);
            msg.setSubject(subject);
            msg.setText(body);
            mailSender.send(msg);
        } catch (Exception e) {
            // SMTP 실패 시에도 개발 편하게 로그로 폴백
            System.out.println(devTag + " [SMTP FAILED] to=" + to + " err=" + e.getMessage());
            System.out.println(body);
        }
    }
}