package auth_service.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "deleted_accounts", indexes = {
    @Index(name = "idx_deleted_google_id", columnList = "google_id"),
    @Index(name = "idx_deleted_email", columnList = "email")
})
public class DeletedAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "google_id")
    private String googleId;

    @Column(nullable = false)
    private String email;

    @Column(name = "deletion_reason")
    private String deletionReason = "USER_REQUESTED";

    @CreationTimestamp
    @Column(name = "deleted_at", nullable = false, updatable = false)
    private LocalDateTime deletedAt;

    public DeletedAccount() {
    }

    public DeletedAccount(Long userId, String googleId, String email, String deletionReason) {
        this.userId = userId;
        this.googleId = googleId;
        this.email = email != null ? email.trim().toLowerCase() : null;
        this.deletionReason = deletionReason != null ? deletionReason : "USER_REQUESTED";
    }

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

    public String getGoogleId() {
        return googleId;
    }

    public void setGoogleId(String googleId) {
        this.googleId = googleId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email != null ? email.trim().toLowerCase() : null;
    }

    public String getDeletionReason() {
        return deletionReason;
    }

    public void setDeletionReason(String deletionReason) {
        this.deletionReason = deletionReason;
    }

    public LocalDateTime getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(LocalDateTime deletedAt) {
        this.deletedAt = deletedAt;
    }
}
