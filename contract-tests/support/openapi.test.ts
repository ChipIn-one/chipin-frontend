import { describe, expect, it } from 'vitest';

import { assertOpenApiResponseFields } from './openapi';

describe('assertOpenApiResponseFields', () => {
    it('does not accept a field that exists only in the request schema', () => {
        const document = `
openapi: 3.0.0
paths:
  /ledger/entries:
    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                participantShares:
                  type: array
      responses:
        '200':
          description: created
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
`;

        expect(() =>
            assertOpenApiResponseFields(document, [
                {
                    path: '/ledger/entries',
                    method: 'post',
                    status: '200',
                    fields: ['participantShares'],
                },
            ]),
        ).toThrow('POST /ledger/entries response 200 is missing field participantShares');
    });

    it('does not accept a field that exists only in another response status', () => {
        const document = `
openapi: 3.0.0
paths:
  /ledger/entries:
    post:
      responses:
        '201':
          description: created
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
        '400':
          description: invalid request
          content:
            application/json:
              schema:
                type: object
                properties:
                  participantShares:
                    type: array
`;

        expect(() =>
            assertOpenApiResponseFields(document, [
                {
                    path: '/ledger/entries',
                    method: 'post',
                    status: '201',
                    fields: ['participantShares'],
                },
            ]),
        ).toThrow('POST /ledger/entries response 201 is missing field participantShares');
    });

    it('resolves nested response schemas through component references', () => {
        const document = `
openapi: 3.0.0
paths:
  /ledger/entries:
    post:
      responses:
        '200':
          description: created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LedgerEntry'
components:
  schemas:
    LedgerEntry:
      type: object
      properties:
        expense:
          $ref: '#/components/schemas/Expense'
    Expense:
      type: object
      properties:
        participantShares:
          type: array
`;

        expect(() =>
            assertOpenApiResponseFields(document, [
                {
                    path: '/ledger/entries',
                    method: 'post',
                    status: '200',
                    fields: ['participantShares'],
                },
            ]),
        ).not.toThrow();
    });
});
