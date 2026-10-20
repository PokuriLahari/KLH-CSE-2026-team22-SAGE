package auth_service.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "reminders", indexes = {
    @Index(name = "idx_reminders_user_id", columnList = "user_id"),
    @Index(name = "idx_reminders_due_status", columnList = "status, delivery_status, due_at")
})
public class Reminder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(name = "due_at", nullable = false)
    private Instant dueAt;

    @Column(length = 50)
    private String status = "open"; // open, completed, snoozed, dismissed

    @Column(length = 50)
    private String method = "Email"; // In-app, Email, Email + In-app

    @Column(name = "notification_timing", length = 20)
    private String notificationTiming = "exact"; // exact, 10m, 30m, 1h, 2h, 1d

    @Column(name = "target_type", length = 50)
    private String targetType = "reminder"; // reminder, task, exam, contest

    @Column(name = "target_id", length = 100)
    private String targetId;

    @Column(name = "contest_id", length = 100)
    private String contestId;

    @Column(length = 100)
    private String platform;

    @Column(name = "contest_url", length = 1000)
    private String contestUrl;

    @Column(name = "event_start_time", length = 100)
    private String eventStartTime;

    @Column(name = "notified_at")
    private Instant notifiedAt;

    @Column(name = "snoozed_until")
    private Instant snoozedUntil;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "delivery_status", length = 30)
    private String deliveryStatus = "PENDING"; // PENDING, DELIVERED, FAILED, SKIPPED

    @Column(name = "delivery_attempts")
    private Integer deliveryAttempts = 0;

    @Column(name = "delivery_error", length = 1000)
    private String deliveryError;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public Reminder() {}

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public Instant getDueAt() {
        return dueAt;
    }

    public void setDueAt(Instant dueAt) {
        this.dueAt = dueAt;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMethod() {
        return method;
    }

    public void setMethod(String method) {
        this.method = method;
    }

    public String getNotificationTiming() {
        return notificationTiming;
    }

    public void setNotificationTiming(String notificationTiming) {
        this.notificationTiming = notificationTiming;
    }

    public String getTargetType() {
        return targetType;
    }

    public void setTargetType(String targetType) {
        this.targetType = targetType;
    }

    public String getTargetId() {
        return targetId;
    }

    public void setTargetId(String targetId) {
        this.targetId = targetId;
    }

    public String getContestId() {
        return contestId;
    }

    public void setContestId(String contestId) {
        this.contestId = contestId;
    }

    public String getPlatform() {
        return platform;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public String getContestUrl() {
        return contestUrl;
    }

    public void setContestUrl(String contestUrl) {
        this.contestUrl = contestUrl;
    }

    public String getEventStartTime() {
        return eventStartTime;
    }

    public void setEventStartTime(String eventStartTime) {
        this.eventStartTime = eventStartTime;
    }

    public Instant getNotifiedAt() {
        return notifiedAt;
    }

    public void setNotifiedAt(Instant notifiedAt) {
        this.notifiedAt = notifiedAt;
    }

    public Instant getSnoozedUntil() {
        return snoozedUntil;
    }

    public void setSnoozedUntil(Instant snoozedUntil) {
        this.snoozedUntil = snoozedUntil;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public String getDeliveryStatus() {
        return deliveryStatus;
    }

    public void setDeliveryStatus(String deliveryStatus) {
        this.deliveryStatus = deliveryStatus;
    }

    public Integer getDeliveryAttempts() {
        return deliveryAttempts != null ? deliveryAttempts : 0;
    }

    public void setDeliveryAttempts(Integer deliveryAttempts) {
        this.deliveryAttempts = deliveryAttempts;
    }

    public String getDeliveryError() {
        return deliveryError;
    }

    public void setDeliveryError(String deliveryError) {
        this.deliveryError = deliveryError;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
