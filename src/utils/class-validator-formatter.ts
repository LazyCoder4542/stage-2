import { BadRequestException, ValidationError } from "@nestjs/common";

interface Error {
  property: string,
  errors: any[]
}

export function exceptionFormatter(validationErrors: ValidationError[] = []) {
  const getPrettyClassValidatorErrors = (
    validationErrors: ValidationError[],
    parentProperty = '',
  ): Array<{ property: string; errors: string[] }> => {
    const errors: Error[] = [];

    const getValidationErrorsRecursively = (
      validationErrors: ValidationError[],
      parentProperty = '',
    ) => {
      for (const error of validationErrors) {
        const propertyPath = parentProperty
          ? `${parentProperty}.${error.property}`
          : error.property;

        if (error.constraints) {
          errors.push({
            property: propertyPath,
            errors: Object.values(error.constraints),
          });
        }

        if (error.children?.length) {
          getValidationErrorsRecursively(error.children, propertyPath);
        }
      }
    };

    getValidationErrorsRecursively(validationErrors, parentProperty);

    return errors;
  };

  const errors = getPrettyClassValidatorErrors(validationErrors);

  // return new BadRequestException({
  //   message: 'validation error',
  //   errors: errors,
  // });

  return new BadRequestException({
    message: 'Invalid query parameters',
  });
}