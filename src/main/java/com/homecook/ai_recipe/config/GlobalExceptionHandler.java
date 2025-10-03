package com.homecook.ai_recipe.config;

import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.NoSuchElementException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    /** 컨트롤러/서비스에서 던진 ResponseStatusException은 상태코드/이유 그대로 전달 */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String,String>> handleRse(ResponseStatusException ex) {
        String msg = ex.getReason() != null ? ex.getReason() : ex.getMessage();
        return ResponseEntity
                .status(ex.getStatusCode())
                .body(Map.of(
                        "error", ex.getStatusCode().toString(), // 예: "404 NOT_FOUND"
                        "message", msg != null ? msg : ""
                ));
    }

    /** 검증 오류 → 400 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String,String>> handleValidation(MethodArgumentNotValidException ex) {
        var fe = ex.getBindingResult().getFieldError();
        String msg = fe != null ? (fe.getField() + " : " + fe.getDefaultMessage()) : "요청이 유효하지 않습니다.";
        return ResponseEntity.badRequest().body(Map.of("error","ValidationError","message", msg));
    }

    /** 본문 파싱 실패(JSON 등) → 400 */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String,String>> handleBadJson(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest().body(Map.of("error","BadRequest","message","요청 본문을 해석할 수 없습니다."));
    }

    /** 비즈니스 충돌 → 409 */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String,String>> handleIllegalState(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error","IllegalState","message", ex.getMessage() != null ? ex.getMessage() : "conflict"));
    }

    /** 권한 부족 → 403 */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String,String>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error","Forbidden","message","forbidden"));
    }

    /** 엔티티 없음/조회 실패 → 404 */
    @ExceptionHandler({ NoSuchElementException.class, EntityNotFoundException.class })
    public ResponseEntity<Map<String,String>> handleNotFound(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error","NotFound","message", ex.getMessage() != null ? ex.getMessage() : "not_found"));
    }

    /** 나머지 전부 → 500 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,String>> handleEtc(Exception ex) {
        String msg = ex.getMessage() == null ? "서버 오류" : ex.getMessage();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error","ServerError","message", msg));
    }
}