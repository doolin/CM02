const VALID_STATUSES = [
  "Implemented",
  "Partially Implemented",
  "Planned",
  "Alternative",
  "Not Applicable",
];

const MAX_NARRATIVE_LENGTH = 5000;
const MAX_FIELD_LENGTH = 500;

function validate(input) {
  const errors = [];

  const systemName = (input.systemName || "").trim();
  if (!systemName) {
    errors.push("systemName is required");
  } else if (systemName.length > MAX_FIELD_LENGTH) {
    errors.push(`systemName must be ${MAX_FIELD_LENGTH} characters or fewer`);
  }

  if (!input.implementationStatus) {
    errors.push("implementationStatus is required");
  } else if (!VALID_STATUSES.includes(input.implementationStatus)) {
    errors.push(
      `implementationStatus must be one of: ${VALID_STATUSES.join(", ")}`,
    );
  }

  const frequency = (input.frequency || "").trim();
  if (!frequency) {
    errors.push("frequency is required");
  } else if (frequency.length > MAX_FIELD_LENGTH) {
    errors.push(`frequency must be ${MAX_FIELD_LENGTH} characters or fewer`);
  }

  const circumstances = (input.circumstances || "").trim();
  if (!circumstances) {
    errors.push("circumstances is required");
  } else if (circumstances.length > MAX_FIELD_LENGTH) {
    errors.push(
      `circumstances must be ${MAX_FIELD_LENGTH} characters or fewer`,
    );
  }

  const narrative = (input.implementationNarrative || "").trim();
  if (!narrative) {
    errors.push("implementationNarrative is required");
  } else if (narrative.length > MAX_NARRATIVE_LENGTH) {
    errors.push(
      `implementationNarrative must be ${MAX_NARRATIVE_LENGTH} characters or fewer`,
    );
  }

  const role = (input.responsibleRole || "").trim();
  if (!role) {
    errors.push("responsibleRole is required");
  } else if (role.length > MAX_FIELD_LENGTH) {
    errors.push(
      `responsibleRole must be ${MAX_FIELD_LENGTH} characters or fewer`,
    );
  }

  return errors;
}

module.exports = { validate, VALID_STATUSES };
