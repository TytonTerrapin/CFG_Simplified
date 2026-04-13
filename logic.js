function _calculate_metrics(grammar) {
    let productions = 0;
    const variables = new Set(Object.keys(grammar));
    const terminals = new Set();
    
    for (const lhs in grammar) {
        for (const rhs of grammar[lhs]) {
            productions++;
            if (rhs === '') continue;
            for (let i = 0; i < rhs.length; i++) {
                const char = rhs[i];
                if (!isUpper(char) && char !== ' ' && char !== '|') {
                    terminals.add(char);
                } else if (isUpper(char)) {
                    variables.add(char);
                }
            }
        }
    }
    return {
        productions,
        variables: variables.size,
        terminals: terminals.size
    };
}

// -----------------------------------------
// 1. Remove Null Productions
// -----------------------------------------
function remove_null_productions(grammar) {
    const step_logs = [];
    const workingGrammar = JSON.parse(JSON.stringify(grammar));
    const { nullable, iterations: nullableIterations } = _find_nullable(workingGrammar);
    
    step_logs.push({
        title: "Find Nullable Non-Terminals",
        description: "A non-terminal is nullable if it can derive ε (empty string). We iteratively find all nullable symbols using a fixed-point algorithm.",
        nullable_symbols: Array.from(nullable),
        iterations: nullableIterations,
        type: "nullable_detection"
    });

    if (nullable.size === 0) {
        return { 
            stageName: "Null Productions Removal",
            grammar: workingGrammar, 
            step_logs, 
            stage_sets: { nullable: [] },
            metrics: _calculate_metrics(workingGrammar)
        };
    }

    const updatedGrammar = {};
    const rule_transformations = [];

    // Initialize updatedGrammar with keys from workingGrammar
    for (const nt in workingGrammar) updatedGrammar[nt] = new Set();

    const sortedEntries = Object.entries(workingGrammar).sort((a, b) => {
        if (a[0] === 'S') return 1;
        if (b[0] === 'S') return -1;
        return 0;
    });

    for (const [non_terminal, productions] of sortedEntries) {
        for (const production of productions) {
            if (production === '') continue; // Skip epsilon
            
            const original_rule = `${non_terminal} → ${production}`;
            const generated_rules = [];
            
            // Keep original
            updatedGrammar[non_terminal].add(production);
            generated_rules.push({
                rule: original_rule,
                reason: "Original production retained as-is (non-ε body).",
                reasoning: `The production ${non_terminal} → ${production} does not directly produce ε, so it is kept in the grammar unchanged.`,
                type: "original"
            });
            
            const nullable_positions = [];
            for (let i = 0; i < production.length; i++) {
                if (nullable.has(production[i])) nullable_positions.push(i);
            }
            
            if (nullable_positions.length > 0) {
                const nullableInProd = nullable_positions.map(i => production[i]);
                for (let r = 1; r <= nullable_positions.length; r++) {
                    const combos = getCombinations(nullable_positions, r);
                    for (const combo of combos) {
                        let new_prod = '';
                        for (let i = 0; i < production.length; i++) {
                            if (!combo.includes(i)) new_prod += production[i];
                        }
                        updatedGrammar[non_terminal].add(new_prod);
                        const removed_symbols = combo.map(i => production[i]);
                        const positions_desc = combo.map(i => `position ${i} (${production[i]})`).join(', ');
                        const remaining_desc = new_prod ? `remaining body: "${new_prod}"` : `empty body (ε)`;
                        generated_rules.push({
                            rule: `${non_terminal} → ${new_prod || 'ε'}`,
                            reason: `Removed nullable symbol(s): ${removed_symbols.join(', ')} at ${positions_desc}`,
                            reasoning: `Since {${removed_symbols.join(', ')}} ∈ Nullable set, removing ${removed_symbols.length === 1 ? 'it' : 'them'} from "${production}" at ${positions_desc} yields ${remaining_desc}. This new production is added to account for derivations where ${removed_symbols.join(' and ')} derive${removed_symbols.length === 1 ? 's' : ''} ε.`,
                            type: "generated"
                        });
                    }
                }
            }
            
            rule_transformations.push({
                original_rule: original_rule,
                nullable_in_production: nullable_positions.map(i => ({ symbol: production[i], position: i })),
                total_combinations: generated_rules.length - 1,
                generated_rules: generated_rules
            });
        }
    }

    const finalGrammar = {};
    const removed_epsilon_rules = [];
    for (const nt in updatedGrammar) {
        const withEps = Array.from(updatedGrammar[nt]);
        const withoutEps = withEps.filter(p => p !== '');
        if (withEps.length !== withoutEps.length) {
            removed_epsilon_rules.push({ rule: `${nt} → ε`, reasoning: `After expansion, ${nt} → ε was generated but is now removed in the final cleanup since all ε-productions must be eliminated.` });
        }
        finalGrammar[nt] = withoutEps;
    }

    step_logs.push({
        title: "Generate Alternative Productions",
        description: "For each production containing nullable symbols, we generate all 2^k − 1 alternatives (where k = count of nullable positions) by systematically removing each subset of nullable occurrences.",
        rule_transformations: rule_transformations,
        type: "production_generation"
    });

    step_logs.push({
        title: "Remove Null Productions",
        description: "All ε productions are completely removed from the grammar. The generated alternatives ensure the language is preserved (except possibly ε itself).",
        removed_epsilon_rules: removed_epsilon_rules,
        type: "null_removal"
    });

    return { 
        stageName: "Null Productions Removal",
        grammar: finalGrammar, 
        step_logs, 
        stage_sets: { nullable: Array.from(nullable) },
        metrics: _calculate_metrics(finalGrammar)
    };
}

function _find_nullable(grammar) {
    const nullable = new Set();
    const iterations = [];
    let changed = true;
    let iterNum = 0;
    
    while (changed) {
        changed = false;
        iterNum++;
        const iterLog = { iteration: iterNum, found: [], reasoning_steps: [] };
        
        for (const [non_terminal, productions] of Object.entries(grammar)) {
            if (nullable.has(non_terminal)) continue;
            
            for (const production of productions) {
                if (production === '') {
                    nullable.add(non_terminal);
                    changed = true;
                    iterLog.found.push(non_terminal);
                    iterLog.reasoning_steps.push({
                        symbol: non_terminal,
                        reason: `${non_terminal} → ε exists directly in the grammar.`,
                        rule_used: `${non_terminal} → ε`,
                        method: 'direct'
                    });
                    break;
                }
                
                let has_terminal = false;
                for (let i = 0; i < production.length; i++) {
                    if (!isUpper(production[i])) {
                        has_terminal = true;
                        break;
                    }
                }
                
                if (has_terminal) continue;
                
                let all_nullable = true;
                for (let i = 0; i < production.length; i++) {
                    if (!nullable.has(production[i])) {
                        all_nullable = false;
                        break;
                    }
                }
                
                if (all_nullable) {
                    nullable.add(non_terminal);
                    changed = true;
                    const symbols = production.split('');
                    iterLog.found.push(non_terminal);
                    iterLog.reasoning_steps.push({
                        symbol: non_terminal,
                        reason: `${non_terminal} → ${production} where all symbols {${symbols.join(', ')}} are already in the Nullable set, so ${non_terminal} can also derive ε transitively.`,
                        rule_used: `${non_terminal} → ${production}`,
                        depends_on: symbols,
                        method: 'transitive'
                    });
                    break;
                }
            }
        }
        
        iterLog.nullable_so_far = Array.from(nullable);
        if (iterLog.found.length > 0) iterations.push(iterLog);
    }
    return { nullable, iterations };
}

// -----------------------------------------
// 2. Remove Unit Productions
// -----------------------------------------
function remove_unit_productions(grammar) {
    const step_logs = [];
    const workingGrammar = JSON.parse(JSON.stringify(grammar));
    const { unit_prods, identification_reasoning } = _find_unit_productions(workingGrammar);
    
    step_logs.push({
        title: "Identify Unit Productions",
        description: "A unit production is of the form A → B where both A and B are single non-terminal symbols. These create unnecessary indirection in the grammar.",
        unit_productions: unit_prods,
        identification_reasoning: identification_reasoning,
        type: "unit_identification"
    });

    if (Object.keys(unit_prods).length === 0) {
        return { 
            stageName: "Unit Productions Removal",
            grammar: workingGrammar, 
            step_logs, 
            stage_sets: { closures: {} },
            metrics: _calculate_metrics(workingGrammar)
        };
    }

    const graph = _build_unit_graph(workingGrammar, unit_prods);
    const { closure, closure_reasoning } = _find_closure(graph, workingGrammar);
    
    const closureArrayFormat = {};
    for (let k in closure) closureArrayFormat[k] = Array.from(closure[k]);

    step_logs.push({
        title: "Find Derivation Closure",
        description: "For each non-terminal, we compute the transitive closure — all non-terminals reachable through chains of unit productions. This uses a fixed-point iteration on the unit production graph.",
        closure: closureArrayFormat,
        closure_reasoning: closure_reasoning,
        type: "closure_calculation"
    });

    const updatedGrammar = {};
    const rule_transformations = [];

    const sortedNTs = Object.keys(workingGrammar).sort((a, b) => {
        if (a === 'S') return 1;
        if (b === 'S') return -1;
        return 0;
    });

    for (const non_terminal of sortedNTs) {
        const current_new_prods = new Set();
        const transformation = {
            non_terminal: non_terminal,
            removed_units: [],
            added_productions: []
        };

        // Document removed unit rules with reasoning
        const unitRulesForNt = workingGrammar[non_terminal].filter(p => _is_unit_production(p));
        for (const ur of unitRulesForNt) {
            transformation.removed_units.push({
                rule: `${non_terminal} → ${ur}`,
                reasoning: `${non_terminal} → ${ur} is a unit production (single non-terminal on RHS). It is removed and replaced with ${ur}'s non-unit productions via the closure.`
            });
        }
        
        // For each variable nt2 in closure[non_terminal], add nt2's non-unit productions to non_terminal.
        for (const nt2 of closure[non_terminal]) {
            if (workingGrammar[nt2]) {
                for (const prod of workingGrammar[nt2]) {
                    if (!_is_unit_production(prod)) {
                        if (!current_new_prods.has(prod)) {
                            current_new_prods.add(prod);
                            // Build the derivation chain path
                            const chain = _find_unit_chain(non_terminal, nt2, graph, workingGrammar);
                            const chainStr = chain.join(' → ');
                            const isSelf = nt2 === non_terminal;
                            transformation.added_productions.push({
                                rule: `${non_terminal} → ${prod}`,
                                derived_from: `${nt2} → ${prod}`,
                                via_unit: chainStr,
                                reasoning: isSelf
                                    ? `${non_terminal} → ${prod} is ${non_terminal}'s own non-unit production, kept directly.`
                                    : `Via unit chain ${chainStr}, the non-unit production ${nt2} → ${prod} is "pulled up" to become ${non_terminal} → ${prod}. This preserves the derivation: ${chainStr} → ${prod}.`
                            });
                        }
                    }
                }
            }
        }
        
        updatedGrammar[non_terminal] = Array.from(current_new_prods);
        if (transformation.removed_units.length > 0 || transformation.added_productions.some(ap => ap.derived_from.split(' → ')[0] !== non_terminal)) {
            rule_transformations.push(transformation);
        }
    }

    step_logs.push({
        title: "Replace Unit Productions",
        description: "Each unit production A → B is replaced with all non-unit productions reachable from A's closure. The derivation chain shows the exact path through which each rule was inherited.",
        rule_transformations: rule_transformations,
        type: "unit_replacement"
    });

    return { 
        stageName: "Unit Productions Removal",
        grammar: updatedGrammar, 
        step_logs,
        stage_sets: { closures: closureArrayFormat },
        metrics: _calculate_metrics(updatedGrammar)
    };
}

function _find_unit_productions(grammar) {
    const unit_prods = {};
    const identification_reasoning = [];
    for (const [non_terminal, productions] of Object.entries(grammar)) {
        const u = productions.filter(prod => _is_unit_production(prod));
        if (u.length > 0) {
            unit_prods[non_terminal] = u;
            for (const up of u) {
                identification_reasoning.push({
                    rule: `${non_terminal} → ${up}`,
                    reasoning: `"${up}" is a single uppercase character (non-terminal), making ${non_terminal} → ${up} a unit production.`
                });
            }
        }
        // Document non-unit productions too for contrast
        const nonUnit = productions.filter(prod => !_is_unit_production(prod));
        for (const nu of nonUnit) {
            identification_reasoning.push({
                rule: `${non_terminal} → ${nu || 'ε'}`,
                reasoning: nu.length !== 1 ? `RHS "${nu || 'ε'}" has ${nu.length === 0 ? 'zero' : nu.length + ' symbol(s)'}, which is not a single non-terminal — not a unit production.`
                    : `"${nu}" is a terminal symbol (lowercase) — not a unit production.`,
                is_unit: false
            });
        }
    }
    return { unit_prods, identification_reasoning };
}

function _is_unit_production(production) {
    return production.length === 1 && isUpper(production);
}

function _build_unit_graph(grammar, unit_prods) {
    const graph = {};
    for (const nt in grammar) graph[nt] = new Set();
    
    for (const [non_terminal, prods] of Object.entries(unit_prods)) {
        for (const prod of prods) {
            if (grammar[prod]) {
                graph[non_terminal].add(prod);
            }
        }
    }
    return graph;
}

function _find_closure(graph, grammar) {
    const all_nts = Object.keys(grammar);
    const closure = {};
    for (const nt of all_nts) closure[nt] = new Set([nt]);
    
    const closure_reasoning = [];
    let changed = true;
    let iteration_count = 0;
    const max_iterations = all_nts.length + 1;
    
    // Log initialization
    closure_reasoning.push({
        iteration: 0,
        description: 'Initialize each closure D(X) = {X} (every variable reaches itself trivially).',
        expansions: all_nts.map(nt => ({ variable: nt, closure: [nt], new_additions: [] }))
    });
    
    while (changed && iteration_count < max_iterations) {
        changed = false;
        iteration_count++;
        const iterExpansions = [];
        
        for (const non_terminal of all_nts) {
            const new_reachable = new Set(closure[non_terminal]);
            const additions = [];
            for (const reachable_nt of Array.from(closure[non_terminal])) {
                if (graph[reachable_nt]) {
                    for (const next_nt of Array.from(graph[reachable_nt])) {
                        if (!new_reachable.has(next_nt)) {
                            new_reachable.add(next_nt);
                            changed = true;
                            additions.push({
                                added: next_nt,
                                via: reachable_nt,
                                reasoning: `${reachable_nt} → ${next_nt} is a unit production, and ${reachable_nt} ∈ D(${non_terminal}), so ${next_nt} is added to D(${non_terminal}).`
                            });
                        }
                    }
                }
            }
            closure[non_terminal] = new_reachable;
            if (additions.length > 0) {
                iterExpansions.push({
                    variable: non_terminal,
                    closure: Array.from(new_reachable),
                    new_additions: additions
                });
            }
        }
        
        if (iterExpansions.length > 0) {
            closure_reasoning.push({
                iteration: iteration_count,
                description: `Iteration ${iteration_count}: Expand closures by following unit production edges.`,
                expansions: iterExpansions
            });
        }
    }
    return { closure, closure_reasoning };
}

function _find_unit_chain(from, to, graph, grammar) {
    if (from === to) return [from];
    // BFS to find shortest unit chain from→to
    const visited = new Set([from]);
    const queue = [[from]];
    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];
        if (graph[current]) {
            for (const next of graph[current]) {
                if (next === to) return [...path, next];
                if (!visited.has(next)) {
                    visited.add(next);
                    queue.push([...path, next]);
                }
            }
        }
    }
    return [from, '...', to]; // Fallback
}

// -----------------------------------------
// 3. Remove Useless Symbols
// -----------------------------------------
function remove_useless_symbols(grammar, stageTitle = "Useless Symbols Removal") {
    const step_logs = [];
    
    // Phase 1: Productive symbols
    const g1 = JSON.parse(JSON.stringify(grammar));
    const { log: log1, grammar: productiveGrammar } = _phase1_remove_nonproductive(g1);
    step_logs.push(log1);
    
    // Phase 2: Reachable symbols (operating on a clean clone of the productive grammar)
    const g2 = JSON.parse(JSON.stringify(productiveGrammar));
    const { log: log2, grammar: finalGrammar } = _phase2_remove_unreachable(g2);
    step_logs.push(log2);
    
    return { 
        stageName: stageTitle,
        grammar: finalGrammar, 
        step_logs,
        stage_sets: {
            generating: log1.productive_symbols,
            reachable: log2.reachable_symbols
        },
        metrics: _calculate_metrics(finalGrammar)
    };
}

function _phase1_remove_nonproductive(grammar) {
    const productive = new Set();
    let changed = true;
    const rule_removals = [];
    const productive_iterations = [];
    let iterNum = 0;
    
    while (changed) {
        changed = false;
        iterNum++;
        const new_productive = new Set();
        const iterLog = { iteration: iterNum, found: [], reasoning_steps: [] };
        
        for (const non_terminal in grammar) {
            if (productive.has(non_terminal)) continue;
            
            for (const production of grammar[non_terminal]) {
                if (_can_derive_terminals(production, productive)) {
                    new_productive.add(non_terminal);
                    changed = true;
                    
                    // Build reasoning
                    if (production === '') {
                        iterLog.reasoning_steps.push({
                            symbol: non_terminal,
                            reason: `${non_terminal} → ε directly produces the empty string (a valid terminal string).`,
                            rule_used: `${non_terminal} → ε`,
                            method: 'direct'
                        });
                    } else {
                        const symbols_in_prod = production.split('');
                        const nonTermsInProd = symbols_in_prod.filter(s => isUpper(s));
                        const terminalsInProd = symbols_in_prod.filter(s => !isUpper(s));
                        if (nonTermsInProd.length === 0) {
                            iterLog.reasoning_steps.push({
                                symbol: non_terminal,
                                reason: `${non_terminal} → ${production} contains only terminal symbols {${terminalsInProd.join(', ')}}, so it directly generates a terminal string.`,
                                rule_used: `${non_terminal} → ${production}`,
                                method: 'direct'
                            });
                        } else {
                            iterLog.reasoning_steps.push({
                                symbol: non_terminal,
                                reason: `${non_terminal} → ${production}: all non-terminals {${nonTermsInProd.join(', ')}} are already proven productive, and terminals {${terminalsInProd.join(', ') || 'none'}} are trivially productive. Therefore ${non_terminal} is productive.`,
                                rule_used: `${non_terminal} → ${production}`,
                                depends_on: nonTermsInProd,
                                method: 'transitive'
                            });
                        }
                    }
                    iterLog.found.push(non_terminal);
                    break;
                }
            }
        }
        for (const nt of new_productive) productive.add(nt);
        iterLog.productive_so_far = Array.from(productive);
        if (iterLog.found.length > 0) productive_iterations.push(iterLog);
    }
    
    const all_nts = new Set(Object.keys(grammar));
    for (const nt in grammar) {
        for (const prod of grammar[nt]) {
            for (const sym of prod) {
                if (isUpper(sym)) all_nts.add(sym);
            }
        }
    }
    const non_productive = new Set(Array.from(all_nts).filter(x => !productive.has(x)));
    
    const filteredGrammar = {};
    const sortedNTsPhase1 = Object.keys(grammar).sort((a, b) => {
        if (a === 'S') return 1;
        if (b === 'S') return -1;
        return 0;
    });

    for (const non_terminal of sortedNTsPhase1) {
        if (!productive.has(non_terminal)) {
            continue;
        }

        const remaining_prods = grammar[non_terminal].filter(prod => {
            for (const sym of prod) {
                if (isUpper(sym) && non_productive.has(sym)) return false;
            }
            return true;
        });

        const removed_prods = grammar[non_terminal].filter(prod => {
            for (const sym of prod) {
                if (isUpper(sym) && non_productive.has(sym)) return true;
            }
            return false;
        });
        
        for (const prod of removed_prods) {
            const bad_syms = [];
            for (const sym of prod) {
                if (isUpper(sym) && non_productive.has(sym)) bad_syms.push(sym);
            }
            rule_removals.push({
                original_rule: `${non_terminal} → ${prod}`,
                reason: `Contains non-productive symbol(s): ${bad_syms.join(', ')}`,
                reasoning: `The production ${non_terminal} → ${prod} references {${bad_syms.join(', ')}} which cannot derive any terminal string. Including this rule would leave dead-end derivation paths, so it is removed.`,
                removed_symbols: bad_syms,
                type: "non_productive"
            });
        }
        
        filteredGrammar[non_terminal] = remaining_prods;
    }

    for (const sym of non_productive) {
        if (grammar[sym]) {
            for (const prod of grammar[sym]) {
                const alreadyLogged = rule_removals.some(r => r.original_rule === `${sym} → ${prod}`);
                if (!alreadyLogged) {
                    rule_removals.push({
                        original_rule: `${sym} → ${prod}`,
                        reason: `Symbol '${sym}' is not productive.`,
                        reasoning: `None of ${sym}'s productions can derive a terminal string (checked across all iterations). The entire variable ${sym} and all its rules are removed.`,
                        removed_symbols: [sym],
                        type: "non_productive"
                    });
                }
            }
        } else if (!rule_removals.some(r => r.removed_symbols && r.removed_symbols.includes(sym))) {
            rule_removals.push({
                original_rule: `(Undefined) ${sym}`,
                reason: `Symbol '${sym}' is undefined (has no rules) and thus never produces terminals.`,
                reasoning: `${sym} appears on the RHS of some production but has no defining rules in the grammar. Without any productions, it can never derive a terminal string.`,
                removed_symbols: [sym],
                type: "non_productive"
            });
        }
    }
    
    return {
        log: {
            title: "Phase 1: Remove Non-Productive Symbols",
            description: "A symbol is productive (generating) if it can derive a string of terminals. We iteratively build the Generating set using a fixed-point algorithm, then remove all non-productive symbols and their rules.",
            productive_symbols: Array.from(productive),
            removed_symbols: Array.from(non_productive),
            removed_rules: rule_removals,
            productive_iterations: productive_iterations,
            type: "phase1"
        },
        grammar: filteredGrammar
    };
}

function _phase2_remove_unreachable(grammar) {
    if (!grammar || !grammar['S']) {
        return {
            log: {
                title: "Phase 2: Remove Non-Reachable Symbols",
                description: "Start symbol 'S' not found. No symbols to check for reachability.",
                reachable_symbols: [],
                removed_symbols: [],
                removed_rules: [],
                bfs_trace: [],
                type: "phase2"
            },
            grammar: {}
        };
    }
    
    const reachable = new Set(['S']);
    const queue = ['S'];
    const rule_removals = [];
    const bfs_trace = [{
        step: 0,
        visiting: 'S',
        reasoning: 'Start symbol S is the root of all derivations — it is trivially reachable.',
        discovered: [],
        reachable_so_far: ['S']
    }];
    let stepNum = 0;
    
    while (queue.length > 0) {
        const current = queue.shift();
        stepNum++;
        
        if (!grammar[current]) continue;
        
        const discovered = [];
        for (const production of grammar[current]) {
            for (const symbol of production) {
                if (isUpper(symbol) && !reachable.has(symbol)) {
                    reachable.add(symbol);
                    queue.push(symbol);
                    discovered.push({
                        symbol: symbol,
                        via_rule: `${current} → ${production}`,
                        reasoning: `${symbol} appears in the production ${current} → ${production}. Since ${current} is reachable, ${symbol} is also reachable.`
                    });
                }
            }
        }
        
        if (discovered.length > 0) {
            bfs_trace.push({
                step: stepNum,
                visiting: current,
                reasoning: `Examining all productions of ${current} to discover reachable symbols.`,
                discovered: discovered,
                reachable_so_far: Array.from(reachable)
            });
        }
    }
    
    const non_reachable = new Set(Object.keys(grammar).filter(sym => !reachable.has(sym)));
    
    const filteredGrammar = {};
    for (const sym of reachable) {
        if (grammar[sym]) {
            filteredGrammar[sym] = grammar[sym];
        }
    }

    for (const sym of non_reachable) {
        if (grammar[sym]) {
            for (const prod of grammar[sym]) {
                rule_removals.push({
                    original_rule: `${sym} → ${prod}`,
                    reason: `Symbol '${sym}' is not reachable from start symbol S`,
                    reasoning: `After BFS traversal from S, ${sym} was never discovered. No chain of derivations starting from S can ever use ${sym}, so all its productions are removed.`,
                    unreachable_symbol: sym,
                    type: "non_reachable"
                });
            }
        }
    }
    
    return {
        log: {
            title: "Phase 2: Remove Non-Reachable Symbols",
            description: "Starting from S, we perform a BFS traversal through all productions to discover every symbol that can appear in some derivation from S. Any symbol not found in this traversal is unreachable and removed.",
            reachable_symbols: Array.from(reachable),
            removed_symbols: Array.from(non_reachable),
            removed_rules: rule_removals,
            bfs_trace: bfs_trace,
            type: "phase2"
        },
        grammar: filteredGrammar
    };
}

function _can_derive_terminals(production, productive) {
    if (production === '') return true;
    for (const symbol of production) {
        if (isUpper(symbol)) {
            if (!productive.has(symbol)) return false;
        }
    }
    return true;
}


function isUpper(char) {
    if (!char) return false;
    const c = char[0];
    return c >= 'A' && c <= 'Z';
}

function getCombinations(arr, k) {
    const results = [];
    function helper(start, combo) {
        if (combo.length === k) {
            results.push([...combo]);
            return;
        }
        for (let i = start; i < arr.length; i++) {
            combo.push(arr[i]);
            helper(i + 1, combo);
            combo.pop();
        }
    }
    helper(0, []);
    return results;
}

// -----------------------------------------
// 4. Grammar Membership Checker
// -----------------------------------------
function check_membership(grammar, target_string, start_symbol = 'S') {
    if (target_string === '') {
        if (grammar[start_symbol] && grammar[start_symbol].includes('')) {
            return [start_symbol, 'ε'];
        }
        return false;
    }

    const queue = [{ current: start_symbol, path: [start_symbol] }];
    const visited = new Set([start_symbol]);
    
    let iterations = 0;
    const MAX_ITERATIONS = 50000;

    while (queue.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        const node = queue.shift();
        
        if (node.current === target_string) {
            return node.path;
        }

        let expanded = false;
        for (let i = 0; i < node.current.length; i++) {
            const char = node.current[i];
            if (isUpper(char)) {
                const pre = node.current.substring(0, i);
                const post = node.current.substring(i + 1);
                
                if (grammar[char]) {
                    for (const prod of grammar[char]) {
                        if (prod === '') continue; 
                        
                        const next_str = pre + prod + post;
                        
                        if (next_str.length <= target_string.length) {
                            if (!visited.has(next_str)) {
                                visited.add(next_str);
                                queue.push({ current: next_str, path: [...node.path, next_str] });
                            }
                        }
                    }
                }
                expanded = true;
                break;
            }
        }
    }
    
    return false;
}

export { remove_null_productions, remove_unit_productions, remove_useless_symbols, _calculate_metrics, isUpper, getCombinations, check_membership };
