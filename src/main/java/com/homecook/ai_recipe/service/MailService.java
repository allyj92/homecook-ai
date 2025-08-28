package com.homecook.ai_recipe.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;

import org.springframework.mail.MailSender;

import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MailService {
    private final JavaMailSender mailSender;

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
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject("[RecipFree] 비밀번호 재설정 안내");

            String html = """
                <p>안녕하세요,</p>
                <p>아래 버튼을 눌러 비밀번호를 재설정하세요.</p>
                <p>
                  <a href="%s" style="display:inline-block;padding:10px 16px;
                     background-color:#009688;color:#fff;text-decoration:none;
                     border-radius:4px;">비밀번호 재설정하기</a>
                </p>
                <p>링크: <a href="%s">%s</a></p>
                <p>링크는 일정 시간 후 만료됩니다.</p>
                <p>감사합니다.<br>- RecipFree</p>
                """.formatted(resetLink, resetLink, resetLink);

            helper.setText(html, true); // ✅ HTML 모드
            mailSender.send(message);

        } catch (Exception e) {
            System.out.println("[DEV][PasswordReset][HTML FAILED] to=" + to + " err=" + e.getMessage());
        }
    }
}