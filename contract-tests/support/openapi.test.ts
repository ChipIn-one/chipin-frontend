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
                    fieldPaths: ['expense.participantShares'],
                },
            ]),
        ).toThrow(
            'POST /ledger/entries response 200 is missing field path expense.participantShares',
        );
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
                  expense:
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
                    fieldPaths: ['expense.participantShares'],
                },
            ]),
        ).toThrow(
            'POST /ledger/entries response 201 is missing field path expense.participantShares',
        );
    });

    it('does not accept the right property name at the wrong nesting level', () => {
        const document = `
openapi: 3.0.0
paths:
  /users/self:
    get:
      responses:
        '200':
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  profile:
                    type: object
                    properties:
                      isPremium:
                        type: boolean
`;

        expect(() =>
            assertOpenApiResponseFields(document, [
                {
                    path: '/users/self',
                    method: 'get',
                    status: '200',
                    fieldPaths: ['isPremium'],
                },
            ]),
        ).toThrow('GET /users/self response 200 is missing field path isPremium');
    });

    it('resolves nested response field paths through component references', () => {
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
                    status: '201',
                    fieldPaths: ['expense.participantShares'],
                },
            ]),
        ).not.toThrow();
    });
});
