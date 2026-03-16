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

  if (!input.systemName || !input.systemName.trim()) {
    errors.push("systemName is required");
  } else if (input.systemName.length > MAX_FIELD_LENGTH) {
    errors.push(`systemName must be ${MAX_FIELD_LENGTH} characters or fewer`);
  }

  if (!input.implementationStatus) {
    errors.push("implementationStatus is required");
  } else if (!VALID_STATUSES.includes(input.implementationStatus)) {
    errors.push(
      `implementationStatus must be one of: ${VALID_STATUSES.join(", ")}`,
    );
  }

  if (!input.frequency || !input.frequency.trim()) {
    errors.push("frequency is required");
  } else if (input.frequency.length > MAX_FIELD_LENGTH) {
    errors.push(`frequency must be ${MAX_FIELD_LENGTH} characters or fewer`);
  }

  if (!input.circumstances || !input.circumstances.trim()) {
    errors.push("circumstances is required");
  } else if (input.circumstances.length > MAX_FIELD_LENGTH) {
    errors.push(
      `circumstances must be ${MAX_FIELD_LENGTH} characters or fewer`,
    );
  }

  if (!input.implementationNarrative || !input.implementationNarrative.trim()) {
    errors.push("implementationNarrative is required");
  } else if (input.implementationNarrative.length > MAX_NARRATIVE_LENGTH) {
    errors.push(
      `implementationNarrative must be ${MAX_NARRATIVE_LENGTH} characters or fewer`,
    );
  }

  if (!input.responsibleRole || !input.responsibleRole.trim()) {
    errors.push("responsibleRole is required");
  } else if (input.responsibleRole.length > MAX_FIELD_LENGTH) {
    errors.push(
      `responsibleRole must be ${MAX_FIELD_LENGTH} characters or fewer`,
    );
  }

  return errors;
}

module.exports = { validate, VALID_STATUSES };
