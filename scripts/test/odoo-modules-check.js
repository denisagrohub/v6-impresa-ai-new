#!/usr/bin/env node
// scripts/test/odoo-modules-check.js
// Verifica moduli Odoo via JSON-RPC

const CONFIG = {
    odooUrl: process.env.NEXT_PUBLIC_ODOO_URL || 'http://185.58.193.226:8069',
    db: process.env.NEXT_PUBLIC_ODOO_DB || 'erpv6',
    username: process.env.NEXT_PUBLIC_ODOO_USERNAME || 'method@agrohubitalia.it',
    password: process.env.NEXT_PUBLIC_ODOO_PASSWORD || 'admin123',
    timeout: 30000,
};

const REQUIRED_MODULES = [
    'erpv6_core', 'erpv6_crypto', 'erpv6_integrity', 'erpv6_tracking',
    'erpv6_kb', 'erpv6_blockchain', 'erpv6_consulting', 'erpv6_booking',
    'erpv6_package', 'erpv6_contract', 'erpv6_sign', 'erpv6_sal_workflow',
    'erpv6_library', 'erpv6_brand', 'erpv6_color', 'erpv6_marketing',
    'erpv6_deep_source',
];

async function callOdoo(service, method, args) {
    const payload = {
        jsonrpc: '2.0',
        method: 'call',
        params: {
            service: service,
            method: method,
            args: args || [],
        },
        id: Date.now(),
    };
    
    console.log('  📤 Chiamata Odoo:', service, method, JSON.stringify(args).substring(0, 100));
    
    const response = await fetch(CONFIG.odooUrl + '/jsonrpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: CONFIG.timeout,
    });
    
    const data = await response.json();
    if (data.error) {
        console.log('  ❌ Errore Odoo:', data.error.message);
        throw new Error(data.error.data?.message || data.error.message || 'Errore Odoo');
    }
    return data.result;
}

async function testOdooConnection() {
    console.log('\n  🔗 Testing Odoo Connection...');
    
    try {
        const version = await callOdoo('common', 'version', []);
        console.log('     Versione Odoo:', version.server_version || version);
        
        const uid = await callOdoo('common', 'login', [CONFIG.db, CONFIG.username, CONFIG.password]);
        
        if (!uid || uid === false || uid === 0) {
            return {
                passed: false,
                error: 'Login fallito - credenziali non valide',
                suggestion: 'Verifica username e password in .env.local',
            };
        }
        
        return {
            passed: true,
            data: { version: version, uid: uid },
            details: '✅ Connesso a Odoo (UID: ' + uid + ')',
        };
    } catch (error) {
        return {
            passed: false,
            error: error.message,
            suggestion: 'Verifica che Odoo sia in esecuzione e l\'URL sia corretto',
        };
    }
}

async function getInstalledModules() {
    try {
        const uid = await callOdoo('common', 'login', [CONFIG.db, CONFIG.username, CONFIG.password]);
        
        // Formato corretto per execute_kw
        const result = await callOdoo('object', 'execute_kw', [
            CONFIG.db,
            uid,
            CONFIG.password,
            'ir.module.module',
            'search_read',
            [
                [['state', '=', 'installed']],
                ['name']
            ]
        ]);
        
        return result.map(function(m) { return m.name; });
    } catch (error) {
        console.log('  ⚠️ Impossibile leggere i moduli:', error.message);
        return [];
    }
}

async function runOdooModulesCheck() {
    console.log('\n🔍 Odoo Modules Verification');
    console.log('='.repeat(50));
    console.log('📡 Odoo URL:', CONFIG.odooUrl);
    console.log('📡 Database:', CONFIG.db);
    console.log('='.repeat(50));
    
    var results = { passed: 0, failed: 0, tests: [], startTime: Date.now() };
    
    var connResult = await testOdooConnection();
    results.tests.push({
        name: 'Odoo Connection',
        passed: connResult.passed,
        details: connResult.details || connResult.error,
        suggestion: connResult.suggestion,
    });
    
    if (connResult.passed) {
        results.passed++;
        console.log('  ' + connResult.details);
    } else {
        results.failed++;
        console.log('  ❌', connResult.error);
        if (connResult.suggestion) console.log('     💡', connResult.suggestion);
        printReport(results);
        return results;
    }
    
    console.log('\n  📦 Checking Required Modules...');
    var installedModules = await getInstalledModules();
    
    if (installedModules.length === 0) {
        console.log('  ⚠️ Nessun modulo trovato su Odoo');
        console.log('  💡 I moduli V6 potrebbero non essere installati su questo server');
        console.log('  📌 Per installarli: cp -r odoo-modules/* /opt/odoo/custom_addons/');
        results.failed++;
        printReport(results);
        return results;
    }
    
    console.log('     Moduli trovati:', installedModules.length);
    
    var missing = [];
    var found = [];
    
    for (var i = 0; i < REQUIRED_MODULES.length; i++) {
        var module = REQUIRED_MODULES[i];
        var foundModule = installedModules.find(function(m) {
            return m.includes(module) || module.includes(m);
        });
        if (foundModule) {
            found.push(module);
        } else {
            missing.push(module);
        }
    }
    
    results.tests.push({
        name: 'Required Modules',
        passed: missing.length === 0,
        details: missing.length === 0 
            ? '✅ Tutti i ' + REQUIRED_MODULES.length + ' moduli installati'
            : '❌ Moduli mancanti: ' + missing.join(', '),
    });
    
    if (missing.length === 0) {
        results.passed++;
        console.log('  ✅ Tutti i', REQUIRED_MODULES.length, 'moduli installati');
    } else {
        results.failed++;
        console.log('  ❌ Moduli mancanti:', missing.join(', '));
        console.log('     💡 Esegui: ./odoo-modules.sh per installarli');
    }
    
    printReport(results);
    return results;
}

function printReport(results) {
    var duration = (Date.now() - results.startTime) / 1000;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ODOO MODULES TEST REPORT');
    console.log('='.repeat(60));
    
    for (var i = 0; i < results.tests.length; i++) {
        var test = results.tests[i];
        var icon = test.passed ? '✅' : '❌';
        console.log('  ' + icon + ' ' + test.name);
        if (test.details) console.log('     ' + test.details);
        if (test.suggestion) console.log('     💡 ' + test.suggestion);
    }
    
    console.log('='.repeat(60));
    console.log('  ✅ Passed: ', results.passed);
    console.log('  ❌ Failed: ', results.failed);
    console.log('  ⏱️  Duration: ', duration.toFixed(2) + 's');
    console.log('='.repeat(60));
    
    if (results.failed === 0) {
        console.log('\n🎉 TUTTI I MODULI ODOO SONO CORRETTAMENTE INSTALLATI!');
    } else {
        console.log('\n⚠️ ' + results.failed + ' test falliti. Verifica i dettagli sopra.');
    }
}

if (require.main === module) {
    runOdooModulesCheck().catch(function(error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runOdooModulesCheck };
