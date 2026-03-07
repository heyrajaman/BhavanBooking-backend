import AuditLog from "../model/auditLog.model.js";

export class AuditRepository {
  /**
   * Logs a system action for compliance.
   */
  async logAction(
    entityName,
    entityId,
    action,
    performedBy,
    previousState,
    newState,
    transaction = null,
  ) {
    return await AuditLog.create(
      {
        entityName,
        entityId,
        action,
        performedBy,
        previousState,
        newState,
      },
      { transaction },
    );
  }
}
