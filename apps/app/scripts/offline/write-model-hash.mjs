// Writes MODEL_SHAPE_HASH (spec 03 §1.4) to src/shared/offline/modelHash.generated.ts: the first
// 12 hex of sha256 over src/entities/*/model/types.ts (paths sorted) plus every type declaration
// reachable from them through type positions (imports, barrels, `typeof`, heritage, computed
// property names), resolved by the TypeScript checker with the paths of tsconfig.app.json. Each
// file and declaration is re-printed by the TypeScript printer without comments, so comments and
// formatting do not change the hash. A reached declaration is hashed without implementation:
// function, method and accessor bodies are dropped, and the initializer of an annotated variable
// or class property too, so only shapes count. A reached declaration whose type would be inferred
// from a value (no return type; no annotation and a non-literal initializer) fails: the hash
// cannot see that shape. Types of the default lib and of npm packages (real path in node_modules)
// are not hashed: the referencing declaration already names them, and their shape is versioned by
// the TypeScript/package versions, not by the domain model. Workspace packages (packages/*, linked
// into node_modules) are part of the repository and are hashed by their real path.
//
// Usage: node scripts/offline/write-model-hash.mjs
import { createHash } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    realpathSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

const repoRoot = resolve(import.meta.dirname, '../..');

export const OUTPUT_PATH = 'src/shared/offline/modelHash.generated.ts';

const printer = ts.createPrinter({ removeComments: true });

const diagnosticText = diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

const parseConfig = tsconfig => {
    const host = {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: diagnostic => {
            throw new Error(`${tsconfig}: ${diagnosticText(diagnostic)}`);
        },
    };
    const parsed = ts.getParsedCommandLineOfConfigFile(tsconfig, { noEmit: true }, host);

    if (!parsed) {
        throw new Error(`cannot read ${tsconfig}`);
    }
    // TS18003 (no inputs) is irrelevant: the roots are passed explicitly.
    const errors = parsed.errors.filter(error => error.code !== 18003);

    if (errors.length > 0) {
        throw new Error(`${tsconfig}: ${diagnosticText(errors[0])}`);
    }
    return parsed.options;
};

/** The top-level statement (of a file or namespace block) that declares `node`. */
const statementOf = node => {
    let current = node;

    while (
        current.parent &&
        !ts.isSourceFile(current.parent) &&
        !ts.isModuleBlock(current.parent)
    ) {
        current = current.parent;
    }
    return current;
};

/**
 * A value whose type is fully written in the source: a string, number, bigint, boolean or null
 * literal, a template without substitutions, and arrays, objects and `as const` of those.
 */
const isPlainLiteral = node => {
    if (
        ts.isStringLiteral(node) ||
        ts.isNumericLiteral(node) ||
        ts.isBigIntLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        node.kind === ts.SyntaxKind.TrueKeyword ||
        node.kind === ts.SyntaxKind.FalseKeyword ||
        node.kind === ts.SyntaxKind.NullKeyword
    ) {
        return true;
    }
    if (ts.isPrefixUnaryExpression(node)) {
        return (
            node.operator === ts.SyntaxKind.MinusToken &&
            (ts.isNumericLiteral(node.operand) || ts.isBigIntLiteral(node.operand))
        );
    }
    if (ts.isParenthesizedExpression(node)) {
        return isPlainLiteral(node.expression);
    }
    if (ts.isAsExpression(node)) {
        return ts.isConstTypeReference(node.type) && isPlainLiteral(node.expression);
    }
    if (ts.isArrayLiteralExpression(node)) {
        return node.elements.every(isPlainLiteral);
    }
    if (ts.isObjectLiteralExpression(node)) {
        return node.properties.every(
            property =>
                ts.isPropertyAssignment(property) &&
                !ts.isComputedPropertyName(property.name) &&
                isPlainLiteral(property.initializer),
        );
    }
    return false;
};

const isFunctionValue = node => ts.isArrowFunction(node) || ts.isFunctionExpression(node);

/**
 * The declaration without implementation: bodies of functions, methods and accessors removed (an
 * arrow or function expression keeps an empty block), and the initializer of an annotated variable
 * or class property dropped. A type inferred from a value calls `inferred(node, what)`.
 */
const shapeOf = (node, inferred) => {
    const strip = context => {
        const { factory } = context;
        const visit = child => {
            const parameters = () => ts.visitNodes(child.parameters, visit);
            const returnType = () => {
                if (!child.type) {
                    inferred(child, 'an explicit return type');
                }
                return child.type;
            };

            if (
                ts.isParameter(child) &&
                !child.type &&
                !ts.isSetAccessorDeclaration(ts.getOriginalNode(child).parent) &&
                !(child.initializer && isPlainLiteral(child.initializer))
            ) {
                // A setter parameter takes the getter's type; any other one is typed or literal.
                inferred(child, 'an explicit type annotation');
            }
            if (ts.isFunctionDeclaration(child)) {
                return factory.updateFunctionDeclaration(
                    child,
                    child.modifiers,
                    child.asteriskToken,
                    child.name,
                    child.typeParameters,
                    parameters(),
                    returnType(),
                    undefined,
                );
            }
            if (ts.isMethodDeclaration(child)) {
                return factory.updateMethodDeclaration(
                    child,
                    child.modifiers,
                    child.asteriskToken,
                    child.name,
                    child.questionToken,
                    child.typeParameters,
                    parameters(),
                    returnType(),
                    undefined,
                );
            }
            if (ts.isConstructorDeclaration(child)) {
                return factory.updateConstructorDeclaration(
                    child,
                    child.modifiers,
                    parameters(),
                    undefined,
                );
            }
            if (ts.isGetAccessorDeclaration(child)) {
                return factory.updateGetAccessorDeclaration(
                    child,
                    child.modifiers,
                    child.name,
                    parameters(),
                    returnType(),
                    undefined,
                );
            }
            if (ts.isSetAccessorDeclaration(child)) {
                return factory.updateSetAccessorDeclaration(
                    child,
                    child.modifiers,
                    child.name,
                    parameters(),
                    undefined,
                );
            }
            if (ts.isArrowFunction(child)) {
                return factory.updateArrowFunction(
                    child,
                    child.modifiers,
                    child.typeParameters,
                    parameters(),
                    returnType(),
                    child.equalsGreaterThanToken,
                    factory.createBlock([]),
                );
            }
            if (ts.isFunctionExpression(child)) {
                return factory.updateFunctionExpression(
                    child,
                    child.modifiers,
                    child.asteriskToken,
                    child.name,
                    child.typeParameters,
                    parameters(),
                    returnType(),
                    factory.createBlock([]),
                );
            }
            if (ts.isVariableDeclaration(child) || ts.isPropertyDeclaration(child)) {
                const { initializer } = child;
                let kept = initializer;

                if (child.type) {
                    kept = undefined;
                } else if (initializer && isFunctionValue(initializer)) {
                    kept = ts.visitNode(initializer, visit);
                } else if (!initializer || !isPlainLiteral(initializer)) {
                    inferred(child, 'an explicit type annotation');
                }
                return ts.isVariableDeclaration(child)
                    ? factory.updateVariableDeclaration(
                          child,
                          child.name,
                          child.exclamationToken,
                          child.type,
                          kept,
                      )
                    : factory.updatePropertyDeclaration(
                          child,
                          child.modifiers,
                          child.name,
                          child.questionToken ?? child.exclamationToken,
                          child.type,
                          kept,
                      );
            }
            return ts.visitEachChild(child, visit, context);
        };

        return root => ts.visitNode(root, visit);
    };
    const result = ts.transform(node, [strip]);
    const [stripped] = result.transformed;

    result.dispose();
    return stripped;
};

const rightmost = name => (ts.isQualifiedName(name) ? name.right : name);
/** The first identifier of `a.b`, `a['b']` or a qualified name `a.b`. */
const leftmost = node => {
    if (ts.isQualifiedName(node)) {
        return leftmost(node.left);
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        return leftmost(node.expression);
    }
    return node;
};

/**
 * The hash inputs: each of `files` (repository-relative POSIX paths) re-printed, sorted by path,
 * then every declaration outside them that they reach through type positions, deduplicated and
 * sorted. Fails closed on an unresolved import or type name and on a reached type inferred from a
 * value.
 *
 * @param {{ root?: string, files: string[], tsconfig?: string }} options
 * @returns {string[]} `path\0printed` entries
 */
export const modelShapeInputs = ({ root = repoRoot, files, tsconfig }) => {
    const options = parseConfig(tsconfig ?? join(root, 'tsconfig.app.json'));
    const paths = [...new Set(files)].sort();
    const program = ts.createProgram({
        rootNames: paths.map(path => join(root, path)),
        options: { ...options, noEmit: true },
    });
    const checker = program.getTypeChecker();
    const realRoot = realpathSync(root);
    const realPath = fileName => (existsSync(fileName) ? realpathSync(fileName) : fileName);
    // POSIX, relative to the app root by real path: a workspace package is `../../packages/...`.
    const relativePath = fileName => relative(realRoot, realPath(fileName)).split(sep).join('/');
    const roots = paths.map(path => {
        const sourceFile = program.getSourceFile(join(root, path));

        if (!sourceFile) {
            throw new Error(`${path} is not in the program`);
        }
        return sourceFile;
    });
    const rootSet = new Set(roots);

    for (const sourceFile of roots) {
        for (const statement of sourceFile.statements) {
            const specifier =
                (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
                statement.moduleSpecifier;

            if (specifier && !checker.getSymbolAtLocation(specifier)) {
                throw new Error(
                    `${relativePath(sourceFile.fileName)}: cannot resolve module ${specifier.getText(sourceFile)}`,
                );
            }
        }
    }

    // statement -> printed entry (filled when the statement is visited)
    const reached = new Map();
    const queue = [];
    const at = node => {
        const original = ts.getOriginalNode(node);
        const sourceFile = original.getSourceFile();
        const { line } = sourceFile.getLineAndCharacterOfPosition(original.getStart(sourceFile));

        return `${relativePath(sourceFile.fileName)}:${line + 1}`;
    };
    const text = node => {
        const original = ts.getOriginalNode(node);

        return original.getText(original.getSourceFile());
    };
    const fail = node => {
        throw new Error(`${at(node)}: cannot resolve type ${text(node)}`);
    };
    const inferred = (node, missing) => {
        const name = node.name ? text(node.name) : text(node).slice(0, 40);

        throw new Error(
            `${at(node)}: the type of ${name} is inferred from its value, which MODEL_SHAPE_HASH cannot see; add ${missing}`,
        );
    };
    const opaque = (node, hint) => {
        throw new Error(
            `${at(node)}: the value of ${text(node).slice(0, 60)} is computed, which MODEL_SHAPE_HASH cannot see; ${hint}`,
        );
    };
    // An npm package: a `node_modules` segment in the path from the app root (a workspace package
    // is `../../packages/...` by its real path).
    const isExternal = sourceFile =>
        program.isSourceFileDefaultLibrary(sourceFile) ||
        relativePath(sourceFile.fileName).split('/').includes('node_modules');
    const isGlobalThis = symbol =>
        symbol?.escapedName === 'globalThis' && !symbol.declarations?.length;
    const resolveAlias = symbol =>
        symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

    const visitedModules = new Set();
    const addSymbol = (symbol, node) => {
        const target = resolveAlias(symbol);

        if (isGlobalThis(target)) {
            return;
        }
        if (!target?.declarations?.length) {
            fail(node);
        }
        if (target.flags & ts.SymbolFlags.TypeParameter) {
            return;
        }
        for (const declaration of target.declarations) {
            const sourceFile = declaration.getSourceFile();

            if (rootSet.has(sourceFile) || isExternal(sourceFile)) {
                continue;
            }
            if (ts.isSourceFile(declaration)) {
                // `typeof import('./module')`: the module's shape is its exports. A namespace
                // re-export cycle visits each module once.
                if (visitedModules.has(target)) {
                    continue;
                }
                visitedModules.add(target);
                for (const exported of checker.getExportsOfModule(target)) {
                    addSymbol(exported, node);
                }
                continue;
            }
            const statement = statementOf(declaration);

            if (!reached.has(statement)) {
                reached.set(statement, undefined);
                queue.push(statement);
            }
        }
    };
    /**
     * `a.b`, `a['b']`, `typeof a.b`: the member's declaration when it is in the repository;
     * otherwise (a mapped or lib member) the declaration of the value `a`, which carries its shape.
     */
    const addMember = (memberSymbol, leftNode, node) => {
        const member = resolveAlias(memberSymbol);
        const declarations = member?.declarations ?? [];

        if (declarations.length === 0) {
            addSymbol(checker.getSymbolAtLocation(leftNode), node);
            return;
        }
        addSymbol(member, node);
        if (declarations.every(declaration => isExternal(declaration.getSourceFile()))) {
            const left = resolveAlias(checker.getSymbolAtLocation(leftNode));

            if (
                left &&
                left !== member &&
                left.flags & ts.SymbolFlags.Value &&
                !(left.flags & ts.SymbolFlags.Module)
            ) {
                addSymbol(left, node);
            }
        }
    };
    /** A value reference (computed name, enum initializer); false when it is not one. */
    const addValue = (expression, node) => {
        if (ts.isIdentifier(expression)) {
            addSymbol(checker.getSymbolAtLocation(expression), node);
        } else if (!ts.isIdentifier(leftmost(expression))) {
            // `'x'.length`, `f().a`: not a path from a declared value.
            return false;
        } else if (ts.isPropertyAccessExpression(expression)) {
            addMember(checker.getSymbolAtLocation(expression.name), leftmost(expression), node);
        } else if (ts.isElementAccessExpression(expression)) {
            addMember(
                checker.getSymbolAtLocation(expression.argumentExpression),
                leftmost(expression),
                node,
            );
        } else {
            return false;
        }
        return true;
    };
    const visit = node => {
        if (ts.isTypeReferenceNode(node)) {
            // `as const` is a type reference to nothing.
            if (!ts.isConstTypeReference(node)) {
                addSymbol(checker.getSymbolAtLocation(rightmost(node.typeName)), node);
            }
        } else if (ts.isExpressionWithTypeArguments(node)) {
            const { expression } = node;

            addSymbol(
                checker.getSymbolAtLocation(
                    ts.isPropertyAccessExpression(expression) ? expression.name : expression,
                ),
                node,
            );
        } else if (ts.isTypeQueryNode(node)) {
            addMember(
                checker.getSymbolAtLocation(rightmost(node.exprName)),
                leftmost(node.exprName),
                node,
            );
        } else if (ts.isImportTypeNode(node)) {
            addSymbol(
                checker.getSymbolAtLocation(
                    node.qualifier ? rightmost(node.qualifier) : node.argument.literal,
                ),
                node,
            );
        } else if (ts.isComputedPropertyName(node)) {
            if (!isPlainLiteral(node.expression) && !addValue(node.expression, node)) {
                opaque(node, 'use a literal or a constant');
            }
        } else if (ts.isEnumMember(node) && node.initializer) {
            if (!isPlainLiteral(node.initializer) && !addValue(node.initializer, node)) {
                opaque(node, 'use a literal or a constant');
            }
        } else if (ts.isExportAssignment(node)) {
            if (!ts.isIdentifier(node.expression)) {
                opaque(node, 'export a named constant with a type annotation');
            }
            addSymbol(checker.getSymbolAtLocation(node.expression), node);
        }
        ts.forEachChild(node, visit);
    };

    // A root is printed whole, but walked as a shape: the same inferred-value checks apply.
    for (const sourceFile of roots) {
        visit(shapeOf(sourceFile, inferred));
    }
    while (queue.length > 0) {
        const statement = queue.pop();
        const sourceFile = statement.getSourceFile();
        const shape = shapeOf(statement, inferred);

        // Only the shape is walked: a type named inside a dropped body or initializer does not count.
        visit(shape);
        reached.set(
            statement,
            `${relativePath(sourceFile.fileName)}\0${printer.printNode(ts.EmitHint.Unspecified, shape, sourceFile)}`,
        );
    }

    return [
        ...roots.map(
            sourceFile => `${relativePath(sourceFile.fileName)}\0${printer.printFile(sourceFile)}`,
        ),
        ...[...new Set(reached.values())].sort(),
    ];
};

/** @param {{ root?: string, files: string[], tsconfig?: string }} options */
export const modelShapeHash = options => {
    const hash = createHash('sha256');

    for (const input of modelShapeInputs(options)) {
        hash.update(`${input}\0`);
    }
    return hash.digest('hex').slice(0, 12);
};

/**
 * `src/entities/<entity>/model/types.ts` files of the repository. Fails closed: a `model/` folder
 * without `types.ts`, or no files at all, throws (a hash over nothing would never bust the cache).
 */
export const modelTypeFiles = (root = repoRoot) => {
    const entities = join(root, 'src/entities');
    const slices = existsSync(entities)
        ? readdirSync(entities, { withFileTypes: true })
              .filter(
                  entry => entry.isDirectory() && existsSync(join(entities, entry.name, 'model')),
              )
              .map(entry => entry.name)
              .sort()
        : [];
    const missing = slices
        .map(slice => `src/entities/${slice}/model/types.ts`)
        .filter(path => !existsSync(join(root, path)));

    if (missing.length > 0) {
        throw new Error(
            `every entities/<slice>/model/ needs a types.ts with its domain types (spec 03 §1.4), missing: ${missing.join(', ')}`,
        );
    }
    if (slices.length === 0) {
        throw new Error(
            'no src/entities/*/model/types.ts found: MODEL_SHAPE_HASH would hash nothing',
        );
    }
    return slices.map(slice => {
        const path = `src/entities/${slice}/model/types.ts`;

        return { path, text: readFileSync(join(root, path), 'utf8') };
    });
};

export const renderModelHash = hash =>
    '// Generated by scripts/offline/write-model-hash.mjs (npm run api:gen). Do not edit.\n' +
    '// The shape of the persisted domain model: part of the query cache buster (spec 03 §1.4).\n' +
    `export const MODEL_SHAPE_HASH = '${hash}';\n`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        const files = modelTypeFiles().map(({ path }) => path);
        const text = renderModelHash(modelShapeHash({ root: repoRoot, files }));

        mkdirSync(dirname(join(repoRoot, OUTPUT_PATH)), { recursive: true });
        writeFileSync(join(repoRoot, OUTPUT_PATH), text);
    } catch (error) {
        process.stderr.write(`write-model-hash: ${error.message}\n`);
        process.exitCode = 1;
    }
}
