// src/main/java/com/homecook/ai_recipe/service/MailService.java
package com.homecook.ai_recipe.service;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.Nullable;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MailService {

    /** 메일러가 없을 수도 있으니 ObjectProvider로 선택 주입 */
    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    /** 발신자 (ex: "RecipFree <no-reply@recipfree.com>") */
    @Value("${mail.from:no-reply@recipfree.com}")
    private String from;

    /** JavaMailSender가 실제로 존재하면 발송 가능 */
    private boolean canSend(@Nullable JavaMailSender sender) {
        return sender != null && from != null && !from.isBlank();
    }

    /** 비밀번호 재설정 메일 (HTML) */
    public void sendPasswordReset(String to, String resetLink) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable(); // 없으면 null
        if (!canSend(sender)) {
            System.out.println("[DEV][PasswordReset][NO SMTP] to=" + to + " link=" + resetLink);
            return;
        }
        try {
            MimeMessage message = sender.createMimeMessage();
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

            helper.setText(html, true); // HTML 본문
            sender.send(message);
        } catch (Exception e) {
            System.out.println("[DEV][PasswordReset][SMTP FAILED] to=" + to + " err=" + e.getMessage());
            System.out.println("link=" + resetLink);
        }
    }

    /** (옵션) 아이디 안내 메일 - 필요 시 사용 */
    public void sendFindId(String to, String emailShown) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (!canSend(sender)) {
            System.out.println("[DEV][FindId][NO SMTP] to=" + to + " email=" + emailShown);
            return;
        }
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");

            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject("[RecipFree] 아이디 안내");
            helper.setText("회원님의 로그인 이메일은 다음과 같습니다:\n\n" + emailShown + "\n\n- RecipFree", false);

            sender.send(message);
        } catch (Exception e) {
            System.out.println("[DEV][FindId][SMTP FAILED] to=" + to + " err=" + e.getMessage());
            System.out.println("email=" + emailShown);
        }
    }
}
