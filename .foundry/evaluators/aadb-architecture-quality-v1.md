# AADB Architecture Quality Evaluator v1

Evaluate how well the AADB architecture response fulfills the query and expected behavior.

## Query

{{query}}

## Response

{{response}}

## Expected behavior

{{expected_behavior}}

## Structured requirements and deterministic context

{{context}}

## Rubric

Rate the response from 1 to 5:

- **5:** Fully satisfies the stated architecture intent. Services and flows are technically coherent, appropriately scoped, and do not make unsupported claims.
- **4:** Satisfies the core intent with one minor omission or debatable design choice that does not undermine the architecture.
- **3:** Partially satisfies the intent but has a meaningful missing capability, weak flow semantics, or unnecessary complexity.
- **2:** Misses multiple core requirements or includes technically misleading architecture relationships.
- **1:** Does not fulfill the request, is internally incoherent, or materially misrepresents the architecture.

Treat multiple architecture patterns as valid when they satisfy the requirements. Do not reward a response merely for containing more services or connections. Do not override deterministic failures such as invalid graph references, orphan services, forbidden flow direction, failed Bicep compilation, or failed Azure Resource Manager validation.
