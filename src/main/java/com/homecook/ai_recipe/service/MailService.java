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

    @Value("${mail.from:no-reply@recipfree.com}")
    private String from;

    @Value("${mail.reset-subject:[RecipFree] 비밀번호 재설정 링크}")
    private String resetSubject;

    /** SMTP 설정이 없으면 false → 콘솔 출력 모드 */
    private boolean canSend() {
        return smtpHost != null && !smtpHost.isBlank();
    }

    public void sendPasswordReset(String to, String link) {
        if (!canSend()) {
            System.out.println("[DEV][PasswordReset] to=" + to + " link=" + link);
            return;
        }
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(from);
        msg.setTo(to);
        msg.setSubject(resetSubject);
        msg.setText("""
                안녕하세요.
                아래 링크에서 비밀번호를 재설정해주세요. (30분간 유효)
                
                %s

                만약 본인이 요청한 것이 아니라면 이 메일을 무시하셔도 됩니다.
                """.formatted(link));
        mailSender.send(msg);
    }
}