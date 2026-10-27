(function(){
'use strict';

// ===================== CONFIG =====================
const CONFIG={
    DOWNLOAD_CHUNK_SIZE:500*1024*1024,
    PING_COUNT:5,
    GRAPH_MAX_POINTS:250,
    UI_UPDATE_INTERVAL:200,
    BLOAT_CHECK_INTERVAL:1000,
    DOWNLOAD_URL:'https://speed.cloudflare.com/__down',
    UPLOAD_URL:'https://speed.cloudflare.com/__up',
    PING_URL:'https://speed.cloudflare.com/__down?bytes=0',
    UPLOAD_CHUNK_SIZE:1*1024*1024,
    HISTORY_KEY:'techovia_history_v11',
    PREV_SPEEDS_KEY:'techovia_prev_speeds',
    HISTORY_MAX:20,
    LANG_KEY:'techovia_lang',
    THEME_KEY:'techovia_theme',
    UNIT_KEY:'techovia_unit',
    CONSENT_KEY:'techovia_consent'
};

// ===================== DEVICE CAPABILITIES =====================
const device={
    cores:navigator.hardwareConcurrency||4,
    memory:navigator.deviceMemory||4,
    isTouch:('ontouchstart' in window)||navigator.maxTouchPoints>0,
    prefersReducedMotion:window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches
};
device.isLowEnd=device.cores<=4||device.memory<=2||device.prefersReducedMotion;
if(device.isLowEnd) document.documentElement.classList.add('perf-low');

// ===================== STATE =====================
const state={
    speeds:[], previousSpeeds:[], currentMax:5, lastFinalSpeed:0,
    basePingMs:0, isRunning:false, stopRequested:false, duration:30,
    tag:'', currentLang:'ar', currentTheme:'neon-dark', speedUnit:'MB/s', wakeLock:null,
    consentGiven:false, dataFetched:false, dataPromise:null,
    netInfo:{isp:null,location:null,ip:null,ipType:null,connType:null,effectType:null},
    deviceInfo:{}, deviceLoaded:false, score:0,
    results:{ping:0,jitter:0,upload:0,bufferbloat:0,download:0,stability:0,noise:0,jitterPct:0,mos:0,score:0,timestamp:null}
};

try{
    const p=sessionStorage.getItem(CONFIG.PREV_SPEEDS_KEY);if(p) state.previousSpeeds=JSON.parse(p);
    const u=localStorage.getItem(CONFIG.UNIT_KEY);if(u) state.speedUnit=u;
}catch(e){}

// ===================== TRANSLATIONS =====================
const T={
ar:{pageTitle:"Techovia اختبار السرعة",brandTag:"اختبار السرعة",language:"اللغة",appearance:"المظهر",settings:"الإعدادات",stopTest:"إيقاف الاختبار",ready:"جاهز للفحص",conn:"جاري الاتصال...",downing:"قياس السرعة",uping:"قياس الرفع",stopped:"تم الإيقاف",done:"اكتمل الفحص",err:"حدث خطأ",btnStart:"بدء الاختبار",running:"جاري القياس...",qNone:"غير متاح",qGood:"اتصال ممتاز",qAvg:"اتصال متوسط",qBad:"اتصال ضعيف",time1gb:"زمن تحميل 1 جيجابايت:",customSize:"حجم مخصص:",customTime:"الزمن المتوقع:",calcTitle:"حاسبة زمن التحميل",graphTitle:"مخطط السرعة اللحظي",graphEmpty:"ابدأ الاختبار لعرض المخطط",warmup:"تسخين",tabOverview:"نظرة عامة",tabDetails:"التفاصيل",tabDevice:"جهازك",tabTrends:"الاتجاهات",tabHistory:"السجل",qsDownload:"تحميل",qsPing:"استجابة",qsJitter:"تقلب",qsMos:"MOS",qsUpload:"رفع",stab:"الاستقرار",noise:"التشويش",bloat:"Bufferbloat",jitterPct:"تذبذب السرعة",advMetrics:"مقاييس متقدمة",usageQuality:"تقييم جودة الاستخدام",gaming:"أداء الألعاب التنافسية",stream:"جودة بث الفيديو",videoSpeed:"سرعة تشغيل الفيديو",videoRes:"دقة الفيديو المناسبة",calls:"مكالمات الفيديو",netISP:"مزود الخدمة",netLocation:"الموقع",netIP:"عنوان IP",netIPType:"نوع IP",netConnType:"نوع الشبكة",netEffectType:"النوع الفعلي",netServer:"سيرفر الفحص",historyTitle:"آخر الاختبارات",noHistory:"لا يوجد سجل بعد",clearAll:"مسح الكل",share:"مشاركة",image:"صورة",copy:"نسخ",export:"JSON",durationLabel:"مدة اختبار التنزيل",dur10:"10 ثوان",dur15:"15 ثانية",dur30:"30 ثانية",dur60:"60 ثانية",devTools:"أدوات المطوّر",openDev:"فتح سجل المطوّر",apiLabel:"واجهة برمجة Mini API",viewApi:"عرض مستندات API",tagPlaceholder:"أضف وسماً (مثال: واي فاي المنزل)",devTitle:"سجل المطوّر",apiTitle:"Techovia Mini API",st4k:"ممتاز لـ 4K",stHd:"جيد جداً لـ 1080p",stSd:"متوسط لـ 720p",stBad:"ضعيف (SD)",gPro:"احترافي (تأخير منخفض)",gStab:"مستقر (جيد)",gLag:"غير مستقر (Lag)",cExcel:"ممتاز (بدون تقطيع)",cGood:"جيد",cBad:"ضعيف للاتصال المرئي",confirmClear:"هل تريد مسح كل السجل؟",noReport:"لا يوجد تقرير بعد",copied:"تم النسخ",copyFailed:"تعذّر النسخ",imgCreating:"جاري إنشاء الصورة...",imgFailed:"فشل إنشاء الصورة",imgSaved:"تم تنزيل الصورة",testFailed:"فشل الاختبار",noTag:"بدون وسم",nt2gSlow:"2G بطيء",nt2g:"2G",nt3g:"3G",nt4g:"4G",nt5g:"5G",ntUnknown:"غير معروف",ntUnsupported:"غير مدعوم",netNotAvailable:"غير متاح",wifi:"واي فاي",cellular:"بيانات الجوال",ethernet:"إيثرنت",scoreTitle:"درجة الاتصال",scoreBadge:"/100",scoreOverall:"التقييم العام",scoreDescEmpty:"أجرِ اختباراً لعرض التقييم",scoreExcellent:"ممتاز جداً",scoreGood:"جيد",scoreFair:"متوسط",scorePoor:"ضعيف",scoreDescExcellent:"اتصال مثالي لكل الاستخدامات",scoreDescGood:"اتصال جيد لمعظم المهام",scoreDescFair:"اتصال متوسط — قد يواجه بطئاً",scoreDescPoor:"اتصال ضعيف — يُنصح بالفحص",readinessStreaming:"جهوزية البث",readinessGaming:"جهوزية الألعاب",readinessCalls:"جهوزية المكالمات",readinessDownload:"جهوزية التنزيل",identityTitle:"بطاقة الاتصال",idSpeed:"السرعة",idGrade:"التقدير",trendsTitle:"تطور السرعة",trendsUnit:"MB/s",trendToday:"اليوم",trend7:"7 أيام",trend30:"30 يوم",trendAll:"الكل",trendNoData:"لا يوجد بيانات كافية",trendAvg:"المتوسط",trendBest:"الأفضل",trendCount:"الاختبارات",privacyTitle:"سياسة الخصوصية",termsTitle:"شروط الاستخدام",legalLabel:"المعلومات القانونية",deviceNoteTitle:"لماذا نعرض لك هذه المعلومات؟",deviceNoteBody:"متصفحك يكشف هذه التفاصيل لكل موقع تزوره. نعرضها لك هنا لتتمكن من:",deviceNoteItem1:"معرفة ما يفعله متصفحك بدون إذنك",deviceNoteItem2:"مقارنة الخصوصية بين المتصفحات",deviceNoteItem3:"اختيار متصفح أكثر أماناً وخصوصية",deviceNoteItem4:"تقليل بصمة جهازك على الإنترنت",deviceNotePrivacy:"لا نجمع هذه المعلومات ولا نخزّنها ولا نرسلها — تُقرأ محلياً فقط.",deviceGroupDevice:"الجهاز والمتصفح",deviceGroupUA:"مؤشرات UA المتقدمة",deviceGroupScreen:"الشاشة والعرض",deviceGroupHW:"مؤشرات الأجهزة (تقريبية)",deviceGroupGPU:"الرسوميات (WebGL)",deviceGroupPrivacy:"إشارات النظام والخصوصية",deviceGroupFP:"بصمة المتصفح",deviceType:"نوع الجهاز",deviceModel:"الموديل",deviceOS:"نظام التشغيل",deviceBrowser:"المتصفح",deviceBrowserVer:"إصدار المتصفح",deviceLang:"اللغة المفضلة",devicePlatform:"المنصة",uaArch:"البنية",uaBitness:"عدد البتات",uaModel:"الطراز الدقيق",uaPlatformVer:"إصدار المنصة",screenRes:"دقة الشاشة",screenAvail:"المساحة المتاحة",screenViewport:"نافذة العرض",screenDPR:"نسبة البكسلات",screenDepth:"عمق الألوان",screenOrient:"الاتجاه",screenTouch:"دعم اللمس",hwCPU:"أنوية المعالج",hwRAM:"ذاكرة الجهاز",hwStorage:"مساحة التخزين",hwBattery:"البطارية",gpuSupported:"WebGL مدعوم",gpuVendor:"الشركة المصنعة",gpuRenderer:"العارض",privTZ:"المنطقة الزمنية",privLocale:"الإعدادات المحلية",privDNT:"Do Not Track",privCookies:"ملفات الكوكيز",privLS:"التخزين المحلي",privSS:"تخزين الجلسة",fpLevelLabel:"مستوى التعرّض",fpDescEmpty:"—",fpLevelLow:"منخفض",fpLevelMid:"متوسط",fpLevelHigh:"مرتفع",fpDescLow:"متصفحك يحمي خصوصيتك بشكل جيد",fpDescMid:"متصفحك يكشف بعض الإشارات",fpDescHigh:"متصفحك يكشف إشارات بصمة متعددة",yes:"نعم",no:"لا",notSupported:"غير مدعوم",unknown:"غير معروف",deviceMobile:"هاتف محمول",deviceTablet:"جهاز لوحي",deviceDesktop:"كمبيوتر",uaCopyDone:"تم نسخ User Agent",aboutLabel:"حول الأداة",aboutDesc:"أداة احترافية لقياس سرعة الإنترنت الحقيقية بدقة عالية، تعمل بالكامل في المتصفح دون جمع أي بيانات شخصية.",copyright:"© 2026 جميع الحقوق محفوظة لمنصة Techovia Developer",consentTitle:"قبل البدء",consentText:"يرجى قراءة ومراجعة الشروط والسياسات التالية قبل استخدام الأداة.",consentCheckLabel:"قرأت جميع الشروط والسياسات المتعلقة بأداة Techovia Speed Test وأوافق عليها",consentAgree:"موافق",consentCancel:"إلغاء",consentClosed:"تم إغلاق الأداة. لا يمكن استخدامها بدون الموافقة على الشروط.",consentRetry:"إعادة المحاولة"},
en:{pageTitle:"Techovia Speed Test",brandTag:"Speed Test",language:"Language",appearance:"Appearance",settings:"Settings",stopTest:"Stop test",ready:"Ready to test",conn:"Connecting...",downing:"Testing",uping:"Testing upload",stopped:"Stopped",done:"Test completed",err:"Error",btnStart:"Start Test",running:"Testing...",qNone:"Not available",qGood:"Excellent connection",qAvg:"Average connection",qBad:"Poor connection",time1gb:"1GB download time:",customSize:"Custom size:",customTime:"Estimated time:",calcTitle:"Download time calculator",graphTitle:"Live speed graph",graphEmpty:"Start the test to see the graph",warmup:"Warm-up",tabOverview:"Overview",tabDetails:"Details",tabDevice:"Your Device",tabTrends:"Trends",tabHistory:"History",qsDownload:"Download",qsPing:"Ping",qsJitter:"Jitter",qsMos:"MOS",qsUpload:"Upload",stab:"Stability",noise:"Noise",bloat:"Bufferbloat",jitterPct:"Speed jitter",advMetrics:"Advanced metrics",usageQuality:"Usage quality score",gaming:"Competitive gaming",stream:"Video streaming",videoSpeed:"Video playback speed",videoRes:"Suitable video resolution",calls:"Video calls",netISP:"ISP",netLocation:"Location",netIP:"IP address",netIPType:"IP type",netConnType:"Connection",netEffectType:"Effective type",netServer:"Test server",historyTitle:"Recent tests",noHistory:"No history yet",clearAll:"Clear all",share:"Share",image:"Image",copy:"Copy",export:"JSON",durationLabel:"Download test duration",dur10:"10s",dur15:"15s",dur30:"30s",dur60:"60s",devTools:"Developer tools",openDev:"Open developer log",apiLabel:"Mini API",viewApi:"View API docs",tagPlaceholder:"Add a tag (e.g. Home Wi-Fi)",devTitle:"Developer console",apiTitle:"Techovia Mini API",st4k:"4K ready",stHd:"1080p HD ready",stSd:"720p SD",stBad:"Poor (SD)",gPro:"Pro (low ping)",gStab:"Stable",gLag:"Unstable (lag)",cExcel:"Excellent (clear)",cGood:"Good",cBad:"Poor for video calls",confirmClear:"Clear all history?",noReport:"No report yet",copied:"Copied",copyFailed:"Copy failed",imgCreating:"Generating image...",imgFailed:"Image generation failed",imgSaved:"Image downloaded",testFailed:"Test failed",noTag:"No tag",nt2gSlow:"Slow 2G",nt2g:"2G",nt3g:"3G",nt4g:"4G",nt5g:"5G",ntUnknown:"Unknown",ntUnsupported:"Unsupported",netNotAvailable:"Not available",wifi:"Wi-Fi",cellular:"Mobile Data",ethernet:"Ethernet",scoreTitle:"Connection score",scoreBadge:"/100",scoreOverall:"Overall rating",scoreDescEmpty:"Run a test to see your score",scoreExcellent:"Excellent",scoreGood:"Good",scoreFair:"Fair",scorePoor:"Poor",scoreDescExcellent:"Ideal for all uses",scoreDescGood:"Good for most tasks",scoreDescFair:"Average — may experience slowdowns",scoreDescPoor:"Weak — consider troubleshooting",readinessStreaming:"Streaming readiness",readinessGaming:"Gaming readiness",readinessCalls:"Calls readiness",readinessDownload:"Download readiness",identityTitle:"Connection card",idSpeed:"Speed",idGrade:"Grade",trendsTitle:"Speed trend",trendsUnit:"MB/s",trendToday:"Today",trend7:"7 days",trend30:"30 days",trendAll:"All",trendNoData:"Not enough data",trendAvg:"Average",trendBest:"Best",trendCount:"Tests",privacyTitle:"Privacy Policy",termsTitle:"Terms of Use",legalLabel:"Legal",deviceNoteTitle:"Why do we show this?",deviceNoteBody:"Your browser reveals this to every site you visit. We show it so you can:",deviceNoteItem1:"See what your browser exposes without consent",deviceNoteItem2:"Compare privacy between browsers",deviceNoteItem3:"Choose a more secure browser",deviceNoteItem4:"Reduce your device fingerprint",deviceNotePrivacy:"We don't collect, store, or send this — it's read locally only.",deviceGroupDevice:"Device & Browser",deviceGroupUA:"Advanced UA Hints",deviceGroupScreen:"Screen & Display",deviceGroupHW:"Hardware (approximate)",deviceGroupGPU:"Graphics (WebGL)",deviceGroupPrivacy:"System & Privacy Signals",deviceGroupFP:"Browser Fingerprint",deviceType:"Device type",deviceModel:"Model",deviceOS:"Operating system",deviceBrowser:"Browser",deviceBrowserVer:"Browser version",deviceLang:"Preferred language",devicePlatform:"Platform",uaArch:"Architecture",uaBitness:"Bitness",uaModel:"Exact model",uaPlatformVer:"Platform version",screenRes:"Screen resolution",screenAvail:"Available area",screenViewport:"Viewport",screenDPR:"Pixel ratio",screenDepth:"Color depth",screenOrient:"Orientation",screenTouch:"Touch support",hwCPU:"CPU cores",hwRAM:"Device memory",hwStorage:"Storage estimate",hwBattery:"Battery",gpuSupported:"WebGL supported",gpuVendor:"GPU vendor",gpuRenderer:"GPU renderer",privTZ:"Timezone",privLocale:"Locale",privDNT:"Do Not Track",privCookies:"Cookies",privLS:"Local storage",privSS:"Session storage",fpLevelLabel:"Exposure level",fpDescEmpty:"—",fpLevelLow:"Low",fpLevelMid:"Medium",fpLevelHigh:"High",fpDescLow:"Your browser protects your privacy well",fpDescMid:"Your browser exposes some signals",fpDescHigh:"Your browser exposes many fingerprint signals",yes:"Yes",no:"No",notSupported:"Not supported",unknown:"Unknown",deviceMobile:"Mobile",deviceTablet:"Tablet",deviceDesktop:"Desktop",uaCopyDone:"User Agent copied",aboutLabel:"About",aboutDesc:"A professional tool for measuring real internet speed with high precision, running entirely in the browser without collecting any data.",copyright:"© 2026 All rights reserved to Techovia Developer",consentTitle:"Before you start",consentText:"Please read and review the following terms and policies before using the tool.",consentCheckLabel:"I have read all terms and policies related to Techovia Speed Test and agree to them",consentAgree:"Agree",consentCancel:"Cancel",consentClosed:"Tool closed. Cannot be used without agreeing to the terms.",consentRetry:"Retry"},
fr:{pageTitle:"Techovia Test de vitesse",brandTag:"Test de vitesse",language:"Langue",appearance:"Apparence",settings:"Paramètres",stopTest:"Arrêter",ready:"Prêt",conn:"Connexion...",downing:"Test",uping:"Test d'envoi",stopped:"Arrêté",done:"Terminé",err:"Erreur",btnStart:"Démarrer",running:"Test...",qNone:"Indisponible",qGood:"Excellente",qAvg:"Moyenne",qBad:"Faible",time1gb:"Temps 1 Go:",customSize:"Taille:",customTime:"Estimé:",calcTitle:"Calculateur",graphTitle:"Graphique",graphEmpty:"Démarrez",warmup:"Échauffement",tabOverview:"Aperçu",tabDetails:"Détails",tabDevice:"Appareil",tabTrends:"Tendances",tabHistory:"Historique",qsDownload:"Téléchargement",qsPing:"Latence",qsJitter:"Gigue",qsMos:"MOS",qsUpload:"Envoi",stab:"Stabilité",noise:"Bruit",bloat:"Bufferbloat",jitterPct:"Variation",advMetrics:"Avancé",usageQuality:"Qualité",gaming:"Jeux",stream:"Streaming",videoSpeed:"Vitesse vidéo",videoRes:"Résolution",calls:"Appels",netISP:"FAI",netLocation:"Lieu",netIP:"IP",netIPType:"Type IP",netConnType:"Connexion",netEffectType:"Type effectif",netServer:"Serveur",historyTitle:"Tests récents",noHistory:"Vide",clearAll:"Tout effacer",share:"Partager",image:"Image",copy:"Copier",export:"JSON",durationLabel:"Durée",dur10:"10s",dur15:"15s",dur30:"30s",dur60:"60s",devTools:"Outils",openDev:"Journal",apiLabel:"Mini API",viewApi:"Docs API",tagPlaceholder:"Tag",devTitle:"Console",apiTitle:"Techovia Mini API",st4k:"4K",stHd:"1080p",stSd:"720p",stBad:"Faible",gPro:"Pro",gStab:"Stable",gLag:"Instable",cExcel:"Excellent",cGood:"Bon",cBad:"Faible",confirmClear:"Effacer?",noReport:"Aucun rapport",copied:"Copié",copyFailed:"Échec",imgCreating:"Création...",imgFailed:"Échec",imgSaved:"Enregistré",testFailed:"Échec",noTag:"Sans tag",nt2gSlow:"2G",nt2g:"2G",nt3g:"3G",nt4g:"4G",nt5g:"5G",ntUnknown:"Inconnu",ntUnsupported:"Non supporté",netNotAvailable:"Indisponible",wifi:"Wi-Fi",cellular:"Données",ethernet:"Ethernet",scoreTitle:"Score",scoreBadge:"/100",scoreOverall:"Note",scoreDescEmpty:"Lancez un test",scoreExcellent:"Excellent",scoreGood:"Bon",scoreFair:"Moyen",scorePoor:"Faible",scoreDescExcellent:"Idéal",scoreDescGood:"Bon",scoreDescFair:"Moyen",scoreDescPoor:"Faible",readinessStreaming:"Streaming",readinessGaming:"Jeux",readinessCalls:"Appels",readinessDownload:"Téléchargement",identityTitle:"Carte connexion",idSpeed:"Vitesse",idGrade:"Note",trendsTitle:"Tendance",trendsUnit:"MB/s",trendToday:"Aujourd'hui",trend7:"7 jours",trend30:"30 jours",trendAll:"Tout",trendNoData:"Données insuffisantes",trendAvg:"Moyenne",trendBest:"Meilleur",trendCount:"Tests",privacyTitle:"Confidentialité",termsTitle:"Conditions",legalLabel:"Mentions",deviceNoteTitle:"Pourquoi?",deviceNoteBody:"Votre navigateur révèle ceci:",deviceNoteItem1:"Voir ce qui est exposé",deviceNoteItem2:"Comparer les navigateurs",deviceNoteItem3:"Choisir un navigateur sûr",deviceNoteItem4:"Réduire l'empreinte",deviceNotePrivacy:"Nous ne collectons rien — local.",deviceGroupDevice:"Appareil",deviceGroupUA:"UA Avancé",deviceGroupScreen:"Écran",deviceGroupHW:"Matériel",deviceGroupGPU:"Graphiques",deviceGroupPrivacy:"Confidentialité",deviceGroupFP:"Empreinte",deviceType:"Type",deviceModel:"Modèle",deviceOS:"OS",deviceBrowser:"Navigateur",deviceBrowserVer:"Version",deviceLang:"Langue",devicePlatform:"Plateforme",uaArch:"Architecture",uaBitness:"Bits",uaModel:"Modèle exact",uaPlatformVer:"Version plateforme",screenRes:"Résolution",screenAvail:"Disponible",screenViewport:"Fenêtre",screenDPR:"Ratio",screenDepth:"Profondeur",screenOrient:"Orientation",screenTouch:"Tactile",hwCPU:"CPU",hwRAM:"RAM",hwStorage:"Stockage",hwBattery:"Batterie",gpuSupported:"WebGL",gpuVendor:"Fabricant",gpuRenderer:"Rendu",privTZ:"Fuseau",privLocale:"Locale",privDNT:"DNT",privCookies:"Cookies",privLS:"Local",privSS:"Session",fpLevelLabel:"Niveau",fpDescEmpty:"—",fpLevelLow:"Bas",fpLevelMid:"Moyen",fpLevelHigh:"Élevé",fpDescLow:"Bien protégé",fpDescMid:"Expose certains signaux",fpDescHigh:"Expose plusieurs signaux",yes:"Oui",no:"Non",notSupported:"Non supporté",unknown:"Inconnu",deviceMobile:"Mobile",deviceTablet:"Tablette",deviceDesktop:"Ordinateur",uaCopyDone:"UA copié",aboutLabel:"À propos",aboutDesc:"Outil professionnel pour mesurer la vitesse réelle d'Internet.",copyright:"© 2026 Tous droits réservés à Techovia Developer",consentTitle:"Avant de commencer",consentText:"Veuillez lire et examiner les conditions suivantes.",consentCheckLabel:"J'ai lu toutes les conditions et politiques et je les accepte",consentAgree:"Accepter",consentCancel:"Annuler",consentClosed:"Outil fermé. Impossible d'utiliser sans accepter.",consentRetry:"Réessayer"},
de:{pageTitle:"Techovia Speedtest",brandTag:"Speed Test",language:"Sprache",appearance:"Aussehen",settings:"Einstellungen",stopTest:"Test stoppen",ready:"Bereit",conn:"Verbinde...",downing:"Test",uping:"Upload-Test",stopped:"Gestoppt",done:"Fertig",err:"Fehler",btnStart:"Start",running:"Teste...",qNone:"N/V",qGood:"Ausgezeichnet",qAvg:"Durchschnitt",qBad:"Schlecht",time1gb:"1GB Zeit:",customSize:"Größe:",customTime:"Geschätzt:",calcTitle:"Rechner",graphTitle:"Live-Grafik",graphEmpty:"Starten",warmup:"Aufwärmen",tabOverview:"Übersicht",tabDetails:"Details",tabDevice:"Gerät",tabTrends:"Trends",tabHistory:"Verlauf",qsDownload:"Download",qsPing:"Ping",qsJitter:"Jitter",qsMos:"MOS",qsUpload:"Upload",stab:"Stabilität",noise:"Rauschen",bloat:"Bufferbloat",jitterPct:"Schwankung",advMetrics:"Erweitert",usageQuality:"Qualität",gaming:"Gaming",stream:"Streaming",videoSpeed:"Video-Geschw.",videoRes:"Auflösung",calls:"Anrufe",netISP:"ISP",netLocation:"Standort",netIP:"IP",netIPType:"IP-Typ",netConnType:"Verbindung",netEffectType:"Effektiv",netServer:"Server",historyTitle:"Letzte Tests",noHistory:"Kein Verlauf",clearAll:"Löschen",share:"Teilen",image:"Bild",copy:"Kopieren",export:"JSON",durationLabel:"Dauer",dur10:"10s",dur15:"15s",dur30:"30s",dur60:"60s",devTools:"Entwickler",openDev:"Log",apiLabel:"Mini API",viewApi:"API-Doku",tagPlaceholder:"Tag",devTitle:"Konsole",apiTitle:"Techovia Mini API",st4k:"4K",stHd:"1080p",stSd:"720p",stBad:"Schwach",gPro:"Pro",gStab:"Stabil",gLag:"Instabil",cExcel:"Ausgezeichnet",cGood:"Gut",cBad:"Schwach",confirmClear:"Löschen?",noReport:"Kein Bericht",copied:"Kopiert",copyFailed:"Fehler",imgCreating:"Erstelle...",imgFailed:"Fehler",imgSaved:"Gespeichert",testFailed:"Fehlgeschlagen",noTag:"Ohne Tag",nt2gSlow:"2G",nt2g:"2G",nt3g:"3G",nt4g:"4G",nt5g:"5G",ntUnknown:"Unbekannt",ntUnsupported:"Nicht unterstützt",netNotAvailable:"N/V",wifi:"WLAN",cellular:"Mobilfunk",ethernet:"Ethernet",scoreTitle:"Wert",scoreBadge:"/100",scoreOverall:"Bewertung",scoreDescEmpty:"Test starten",scoreExcellent:"Ausgezeichnet",scoreGood:"Gut",scoreFair:"Mittel",scorePoor:"Schwach",scoreDescExcellent:"Ideal",scoreDescGood:"Gut",scoreDescFair:"Mittel",scoreDescPoor:"Schwach",readinessStreaming:"Streaming",readinessGaming:"Gaming",readinessCalls:"Anrufe",readinessDownload:"Download",identityTitle:"Verbindung",idSpeed:"Geschw.",idGrade:"Note",trendsTitle:"Trend",trendsUnit:"MB/s",trendToday:"Heute",trend7:"7 Tage",trend30:"30 Tage",trendAll:"Alle",trendNoData:"Nicht genug Daten",trendAvg:"Durchschnitt",trendBest:"Beste",trendCount:"Tests",privacyTitle:"Datenschutz",termsTitle:"Nutzungsbedingungen",legalLabel:"Rechtliches",deviceNoteTitle:"Warum?",deviceNoteBody:"Ihr Browser zeigt dies jeder Website:",deviceNoteItem1:"Was preisgegeben wird sehen",deviceNoteItem2:"Browser vergleichen",deviceNoteItem3:"Sicheren Browser wählen",deviceNoteItem4:"Fingerprint reduzieren",deviceNotePrivacy:"Wir sammeln nichts — nur lokal.",deviceGroupDevice:"Gerät",deviceGroupUA:"UA Hints",deviceGroupScreen:"Bildschirm",deviceGroupHW:"Hardware",deviceGroupGPU:"Grafik",deviceGroupPrivacy:"Datenschutz",deviceGroupFP:"Fingerprint",deviceType:"Typ",deviceModel:"Modell",deviceOS:"OS",deviceBrowser:"Browser",deviceBrowserVer:"Version",deviceLang:"Sprache",devicePlatform:"Plattform",uaArch:"Architektur",uaBitness:"Bits",uaModel:"Exaktes Modell",uaPlatformVer:"Plattform-Version",screenRes:"Auflösung",screenAvail:"Verfügbar",screenViewport:"Viewport",screenDPR:"Pixelratio",screenDepth:"Farbtiefe",screenOrient:"Ausrichtung",screenTouch:"Touch",hwCPU:"CPU",hwRAM:"RAM",hwStorage:"Speicher",hwBattery:"Batterie",gpuSupported:"WebGL",gpuVendor:"Hersteller",gpuRenderer:"Renderer",privTZ:"Zeitzone",privLocale:"Locale",privDNT:"DNT",privCookies:"Cookies",privLS:"Lokal",privSS:"Session",fpLevelLabel:"Stufe",fpDescEmpty:"—",fpLevelLow:"Niedrig",fpLevelMid:"Mittel",fpLevelHigh:"Hoch",fpDescLow:"Gut geschützt",fpDescMid:"Einige Signale",fpDescHigh:"Viele Signale",yes:"Ja",no:"Nein",notSupported:"Nicht unterstützt",unknown:"Unbekannt",deviceMobile:"Mobil",deviceTablet:"Tablet",deviceDesktop:"Desktop",uaCopyDone:"UA kopiert",aboutLabel:"Über",aboutDesc:"Professionelles Tool zur Messung der echten Internetgeschwindigkeit.",copyright:"© 2026 Alle Rechte vorbehalten — Techovia Developer",consentTitle:"Bevor Sie beginnen",consentText:"Bitte lesen und überprüfen Sie die folgenden Bedingungen.",consentCheckLabel:"Ich habe alle Bedingungen gelesen und stimme zu",consentAgree:"Zustimmen",consentCancel:"Abbrechen",consentClosed:"Tool geschlossen. Kann nicht ohne Zustimmung verwendet werden.",consentRetry:"Wiederholen"},
es:{pageTitle:"Techovia Test de Velocidad",brandTag:"Test de Velocidad",language:"Idioma",appearance:"Apariencia",settings:"Ajustes",stopTest:"Detener test",ready:"Listo",conn:"Conectando...",downing:"Probando",uping:"Probando subida",stopped:"Detenido",done:"Completado",err:"Error",btnStart:"Iniciar",running:"Probando...",qNone:"N/D",qGood:"Excelente",qAvg:"Media",qBad:"Pobre",time1gb:"Tiempo 1GB:",customSize:"Tamaño:",customTime:"Estimado:",calcTitle:"Calculadora",graphTitle:"Gráfico",graphEmpty:"Inicia",warmup:"Calentando",tabOverview:"Resumen",tabDetails:"Detalles",tabDevice:"Dispositivo",tabTrends:"Tendencias",tabHistory:"Historial",qsDownload:"Descarga",qsPing:"Ping",qsJitter:"Jitter",qsMos:"MOS",qsUpload:"Subida",stab:"Estabilidad",noise:"Ruido",bloat:"Bufferbloat",jitterPct:"Variación",advMetrics:"Avanzado",usageQuality:"Calidad",gaming:"Juegos",stream:"Streaming",videoSpeed:"Velocidad video",videoRes:"Resolución",calls:"Llamadas",netISP:"ISP",netLocation:"Ubicación",netIP:"IP",netIPType:"Tipo IP",netConnType:"Conexión",netEffectType:"Tipo efectivo",netServer:"Servidor",historyTitle:"Tests recientes",noHistory:"Vacío",clearAll:"Borrar",share:"Compartir",image:"Imagen",copy:"Copiar",export:"JSON",durationLabel:"Duración",dur10:"10s",dur15:"15s",dur30:"30s",dur60:"60s",devTools:"Herramientas",openDev:"Log",apiLabel:"Mini API",viewApi:"Ver API",tagPlaceholder:"Etiqueta",devTitle:"Consola",apiTitle:"Techovia Mini API",st4k:"4K",stHd:"1080p",stSd:"720p",stBad:"Pobre",gPro:"Pro",gStab:"Estable",gLag:"Inestable",cExcel:"Excelente",cGood:"Bueno",cBad:"Pobre",confirmClear:"¿Borrar?",noReport:"Sin reporte",copied:"Copiado",copyFailed:"Error",imgCreating:"Generando...",imgFailed:"Error",imgSaved:"Guardado",testFailed:"Fallido",noTag:"Sin etiqueta",nt2gSlow:"2G",nt2g:"2G",nt3g:"3G",nt4g:"4G",nt5g:"5G",ntUnknown:"Desconocido",ntUnsupported:"No soportado",netNotAvailable:"N/D",wifi:"Wi-Fi",cellular:"Datos móviles",ethernet:"Ethernet",scoreTitle:"Puntuación",scoreBadge:"/100",scoreOverall:"Evaluación",scoreDescEmpty:"Ejecuta un test",scoreExcellent:"Excelente",scoreGood:"Bueno",scoreFair:"Regular",scorePoor:"Pobre",scoreDescExcellent:"Ideal",scoreDescGood:"Bueno",scoreDescFair:"Regular",scoreDescPoor:"Pobre",readinessStreaming:"Streaming",readinessGaming:"Juegos",readinessCalls:"Llamadas",readinessDownload:"Descarga",identityTitle:"Tarjeta",idSpeed:"Velocidad",idGrade:"Nota",trendsTitle:"Tendencia",trendsUnit:"MB/s",trendToday:"Hoy",trend7:"7 días",trend30:"30 días",trendAll:"Todo",trendNoData:"Datos insuficientes",trendAvg:"Media",trendBest:"Mejor",trendCount:"Tests",privacyTitle:"Privacidad",termsTitle:"Términos",legalLabel:"Legal",deviceNoteTitle:"¿Por qué?",deviceNoteBody:"Tu navegador revela esto:",deviceNoteItem1:"Ver qué se expone",deviceNoteItem2:"Comparar navegadores",deviceNoteItem3:"Elegir uno seguro",deviceNoteItem4:"Reducir huella",deviceNotePrivacy:"No recopilamos — solo local.",deviceGroupDevice:"Dispositivo",deviceGroupUA:"UA Avanzado",deviceGroupScreen:"Pantalla",deviceGroupHW:"Hardware",deviceGroupGPU:"Gráficos",deviceGroupPrivacy:"Privacidad",deviceGroupFP:"Huella",deviceType:"Tipo",deviceModel:"Modelo",deviceOS:"SO",deviceBrowser:"Navegador",deviceBrowserVer:"Versión",deviceLang:"Idioma",devicePlatform:"Plataforma",uaArch:"Arquitectura",uaBitness:"Bits",uaModel:"Modelo exacto",uaPlatformVer:"Versión de plataforma",screenRes:"Resolución",screenAvail:"Disponible",screenViewport:"Viewport",screenDPR:"Ratio",screenDepth:"Profundidad",screenOrient:"Orientación",screenTouch:"Táctil",hwCPU:"CPU",hwRAM:"RAM",hwStorage:"Almacenamiento",hwBattery:"Batería",gpuSupported:"WebGL",gpuVendor:"Fabricante",gpuRenderer:"Renderizador",privTZ:"Zona horaria",privLocale:"Locale",privDNT:"DNT",privCookies:"Cookies",privLS:"Local",privSS:"Sesión",fpLevelLabel:"Nivel",fpDescEmpty:"—",fpLevelLow:"Bajo",fpLevelMid:"Medio",fpLevelHigh:"Alto",fpDescLow:"Buena protección",fpDescMid:"Expone algunas",fpDescHigh:"Expone muchas",yes:"Sí",no:"No",notSupported:"No soportado",unknown:"Desconocido",deviceMobile:"Móvil",deviceTablet:"Tableta",deviceDesktop:"Escritorio",uaCopyDone:"UA copiado",aboutLabel:"Acerca de",aboutDesc:"Herramienta profesional para medir la velocidad real.",copyright:"© 2026 Todos los derechos reservados a Techovia Developer",consentTitle:"Antes de empezar",consentText:"Por favor lea y revise los siguientes términos y políticas.",consentCheckLabel:"He leído todos los términos y políticas y estoy de acuerdo",consentAgree:"Aceptar",consentCancel:"Cancelar",consentClosed:"Herramienta cerrada. No se puede usar sin aceptar.",consentRetry:"Reintentar"},
tr:{pageTitle:"Techovia Hız Testi",brandTag:"Hız Testi",language:"Dil",appearance:"Görünüm",settings:"Ayarlar",stopTest:"Testi durdur",ready:"Hazır",conn:"Bağlanıyor...",downing:"Test",uping:"Yükleme testi",stopped:"Durduruldu",done:"Tamam",err:"Hata",btnStart:"Başlat",running:"Test...",qNone:"Yok",qGood:"Mükemmel",qAvg:"Orta",qBad:"Zayıf",time1gb:"1GB süre:",customSize:"Boyut:",customTime:"Tahmini:",calcTitle:"Hesaplayıcı",graphTitle:"Canlı grafik",graphEmpty:"Başlatın",warmup:"Isınma",tabOverview:"Genel",tabDetails:"Detaylar",tabDevice:"Cihaz",tabTrends:"Trendler",tabHistory:"Geçmiş",qsDownload:"İndirme",qsPing:"Ping",qsJitter:"Jitter",qsMos:"MOS",qsUpload:"Yükleme",stab:"Kararlılık",noise:"Gürültü",bloat:"Bufferbloat",jitterPct:"Dalgalanma",advMetrics:"Gelişmiş",usageQuality:"Kalite",gaming:"Oyun",stream:"Yayın",videoSpeed:"Video hızı",videoRes:"Çözünürlük",calls:"Aramalar",netISP:"ISS",netLocation:"Konum",netIP:"IP",netIPType:"IP tipi",netConnType:"Bağlantı",netEffectType:"Etkin tip",netServer:"Sunucu",historyTitle:"Son testler",noHistory:"Boş",clearAll:"Sil",share:"Paylaş",image:"Görsel",copy:"Kopyala",export:"JSON",durationLabel:"Süre",dur10:"10sn",dur15:"15sn",dur30:"30sn",dur60:"60sn",devTools:"Geliştirici",openDev:"Log",apiLabel:"Mini API",viewApi:"API",tagPlaceholder:"Etiket",devTitle:"Konsol",apiTitle:"Techovia Mini API",st4k:"4K",stHd:"1080p",stSd:"720p",stBad:"Zayıf",gPro:"Pro",gStab:"Kararlı",gLag:"Kararsız",cExcel:"Mükemmel",cGood:"İyi",cBad:"Zayıf",confirmClear:"Silinsin?",noReport:"Rapor yok",copied:"Kopyalandı",copyFailed:"Hata",imgCreating:"Oluşturuluyor...",imgFailed:"Hata",imgSaved:"Kaydedildi",testFailed:"Başarısız",noTag:"Etiketsiz",nt2gSlow:"2G",nt2g:"2G",nt3g:"3G",nt4g:"4G",nt5g:"5G",ntUnknown:"Bilinmiyor",ntUnsupported:"Desteklenmiyor",netNotAvailable:"Yok",wifi:"Wi-Fi",cellular:"Mobil Veri",ethernet:"Ethernet",scoreTitle:"Puan",scoreBadge:"/100",scoreOverall:"Genel",scoreDescEmpty:"Test çalıştırın",scoreExcellent:"Mükemmel",scoreGood:"İyi",scoreFair:"Orta",scorePoor:"Zayıf",scoreDescExcellent:"İdeal",scoreDescGood:"İyi",scoreDescFair:"Orta",scoreDescPoor:"Zayıf",readinessStreaming:"Yayın",readinessGaming:"Oyun",readinessCalls:"Aramalar",readinessDownload:"İndirme",identityTitle:"Bağlantı kartı",idSpeed:"Hız",idGrade:"Not",trendsTitle:"Hız trendi",trendsUnit:"MB/s",trendToday:"Bugün",trend7:"7 gün",trend30:"30 gün",trendAll:"Tümü",trendNoData:"Yeterli veri yok",trendAvg:"Ortalama",trendBest:"En iyi",trendCount:"Testler",privacyTitle:"Gizlilik",termsTitle:"Şartlar",legalLabel:"Yasal",deviceNoteTitle:"Neden?",deviceNoteBody:"Tarayıcınız her siteye bunları gösterir:",deviceNoteItem1:"Neler açık görün",deviceNoteItem2:"Tarayıcıları karşılaştır",deviceNoteItem3:"Güvenli olanı seç",deviceNoteItem4:"İzini azalt",deviceNotePrivacy:"Toplamıyoruz — sadece yerel.",deviceGroupDevice:"Cihaz",deviceGroupUA:"UA İpuçları",deviceGroupScreen:"Ekran",deviceGroupHW:"Donanım",deviceGroupGPU:"Grafikler",deviceGroupPrivacy:"Gizlilik",deviceGroupFP:"Parmak izi",deviceType:"Tür",deviceModel:"Model",deviceOS:"İşletim sistemi",deviceBrowser:"Tarayıcı",deviceBrowserVer:"Sürüm",deviceLang:"Dil",devicePlatform:"Platform",uaArch:"Mimari",uaBitness:"Bit",uaModel:"Tam model",uaPlatformVer:"Platform sürümü",screenRes:"Çözünürlük",screenAvail:"Kullanılabilir",screenViewport:"Görünüm",screenDPR:"Piksel oranı",screenDepth:"Renk derinliği",screenOrient:"Yön",screenTouch:"Dokunmatik",hwCPU:"CPU",hwRAM:"RAM",hwStorage:"Depolama",hwBattery:"Pil",gpuSupported:"WebGL",gpuVendor:"Üretici",gpuRenderer:"İşleyici",privTZ:"Saat dilimi",privLocale:"Yerel",privDNT:"DNT",privCookies:"Çerezler",privLS:"Yerel",privSS:"Oturum",fpLevelLabel:"Seviye",fpDescEmpty:"—",fpLevelLow:"Düşük",fpLevelMid:"Orta",fpLevelHigh:"Yüksek",fpDescLow:"İyi korunuyor",fpDescMid:"Bazı sinyaller",fpDescHigh:"Birçok sinyal",yes:"Evet",no:"Hayır",notSupported:"Desteklenmiyor",unknown:"Bilinmiyor",deviceMobile:"Mobil",deviceTablet:"Tablet",deviceDesktop:"Masaüstü",uaCopyDone:"UA kopyalandı",aboutLabel:"Hakkında",aboutDesc:"Gerçek internet hızını ölçmek için profesyonel araç.",copyright:"© 2026 Techovia Developer'a tüm hakları saklıdır",consentTitle:"Başlamadan önce",consentText:"Lütfen aracı kullanmadan önce aşağıdaki şartları okuyun.",consentCheckLabel:"Tüm şartları ve politikaları okudum ve kabul ediyorum",consentAgree:"Kabul Et",consentCancel:"İptal",consentClosed:"Araç kapatıldı. Şartlar kabul edilmeden kullanılamaz.",consentRetry:"Tekrar Dene"},
nl:{pageTitle:"Techovia Snelheidstest",brandTag:"Snelheidstest",language:"Taal",appearance:"Weergave",settings:"Instellingen",stopTest:"Test stoppen",ready:"Klaar",conn:"Verbinden...",downing:"Testen",uping:"Upload testen",stopped:"Gestopt",done:"Voltooid",err:"Fout",btnStart:"Start",running:"Testen...",qNone:"N/B",qGood:"Uitstekend",qAvg:"Gemiddeld",qBad:"Slecht",time1gb:"1GB tijd:",customSize:"Grootte:",customTime:"Geschat:",calcTitle:"Rekentool",graphTitle:"Live grafiek",graphEmpty:"Start",warmup:"Opwarmen",tabOverview:"Overzicht",tabDetails:"Details",tabDevice:"Apparaat",tabTrends:"Trends",tabHistory:"Geschiedenis",qsDownload:"Download",qsPing:"Ping",qsJitter:"Jitter",qsMos:"MOS",qsUpload:"Upload",stab:"Stabiliteit",noise:"Ruis",bloat:"Bufferbloat",jitterPct:"Schommeling",advMetrics:"Geavanceerd",usageQuality:"Kwaliteit",gaming:"Gaming",stream:"Streaming",videoSpeed:"Videosnelheid",videoRes:"Resolutie",calls:"Bellen",netISP:"ISP",netLocation:"Locatie",netIP:"IP",netIPType:"IP-type",netConnType:"Verbinding",netEffectType:"Effectief",netServer:"Server",historyTitle:"Recente tests",noHistory:"Leeg",clearAll:"Wissen",share:"Delen",image:"Afbeelding",copy:"Kopiëren",export:"JSON",durationLabel:"Duur",dur10:"10s",dur15:"15s",dur30:"30s",dur60:"60s",devTools:"Ontwikkelaar",openDev:"Log",apiLabel:"Mini API",viewApi:"API",tagPlaceholder:"Tag",devTitle:"Console",apiTitle:"Techovia Mini API",st4k:"4K",stHd:"1080p",stSd:"720p",stBad:"Slecht",gPro:"Pro",gStab:"Stabiel",gLag:"Onstabiel",cExcel:"Uitstekend",cGood:"Goed",cBad:"Slecht",confirmClear:"Wissen?",noReport:"Geen rapport",copied:"Gekopieerd",copyFailed:"Fout",imgCreating:"Maken...",imgFailed:"Fout",imgSaved:"Opgeslagen",testFailed:"Mislukt",noTag:"Geen tag",nt2gSlow:"2G",nt2g:"2G",nt3g:"3G",nt4g:"4G",nt5g:"5G",ntUnknown:"Onbekend",ntUnsupported:"Niet ondersteund",netNotAvailable:"N/B",wifi:"Wi-Fi",cellular:"Mobiel",ethernet:"Ethernet",scoreTitle:"Score",scoreBadge:"/100",scoreOverall:"Totaal",scoreDescEmpty:"Start een test",scoreExcellent:"Uitstekend",scoreGood:"Goed",scoreFair:"Gemiddeld",scorePoor:"Slecht",scoreDescExcellent:"Ideaal",scoreDescGood:"Goed",scoreDescFair:"Gemiddeld",scoreDescPoor:"Slecht",readinessStreaming:"Streaming",readinessGaming:"Gaming",readinessCalls:"Bellen",readinessDownload:"Download",identityTitle:"Verbindingskaart",idSpeed:"Snelheid",idGrade:"Cijfer",trendsTitle:"Trend",trendsUnit:"MB/s",trendToday:"Vandaag",trend7:"7 dagen",trend30:"30 dagen",trendAll:"Alle",trendNoData:"Onvoldoende data",trendAvg:"Gemiddelde",trendBest:"Beste",trendCount:"Tests",privacyTitle:"Privacy",termsTitle:"Voorwaarden",legalLabel:"Juridisch",deviceNoteTitle:"Waarom?",deviceNoteBody:"Uw browser toont dit aan elke site:",deviceNoteItem1:"Zie wat wordt getoond",deviceNoteItem2:"Vergelijk browsers",deviceNoteItem3:"Kies veilige browser",deviceNoteItem4:"Verminder vingerafdruk",deviceNotePrivacy:"Wij verzamelen niets — lokaal.",deviceGroupDevice:"Apparaat",deviceGroupUA:"UA Hints",deviceGroupScreen:"Scherm",deviceGroupHW:"Hardware",deviceGroupGPU:"Grafisch",deviceGroupPrivacy:"Privacy",deviceGroupFP:"Vingerafdruk",deviceType:"Type",deviceModel:"Model",deviceOS:"OS",deviceBrowser:"Browser",deviceBrowserVer:"Versie",deviceLang:"Taal",devicePlatform:"Platform",uaArch:"Architectuur",uaBitness:"Bits",uaModel:"Exact model",uaPlatformVer:"Platformversie",screenRes:"Resolutie",screenAvail:"Beschikbaar",screenViewport:"Viewport",screenDPR:"Pixelratio",screenDepth:"Kleurdiepte",screenOrient:"Oriëntatie",screenTouch:"Touch",hwCPU:"CPU",hwRAM:"RAM",hwStorage:"Opslag",hwBattery:"Batterij",gpuSupported:"WebGL",gpuVendor:"Fabrikant",gpuRenderer:"Renderer",privTZ:"Tijdzone",privLocale:"Locale",privDNT:"DNT",privCookies:"Cookies",privLS:"Lokaal",privSS:"Sessie",fpLevelLabel:"Niveau",fpDescEmpty:"—",fpLevelLow:"Laag",fpLevelMid:"Gemiddeld",fpLevelHigh:"Hoog",fpDescLow:"Goed beschermd",fpDescMid:"Sommige signalen",fpDescHigh:"Veel signalen",yes:"Ja",no:"Nee",notSupported:"Niet ondersteund",unknown:"Onbekend",deviceMobile:"Mobiel",deviceTablet:"Tablet",deviceDesktop:"Desktop",uaCopyDone:"UA gekopieerd",aboutLabel:"Over",aboutDesc:"Professionele tool om de echte internetsnelheid te meten.",copyright:"© 2026 Alle rechten voorbehouden aan Techovia Developer",consentTitle:"Voordat je begint",consentText:"Lees en controleer de volgende voorwaarden voordat u de tool gebruikt.",consentCheckLabel:"Ik heb alle voorwaarden gelezen en ga ermee akkoord",consentAgree:"Akkoord",consentCancel:"Annuleren",consentClosed:"Tool gesloten. Kan niet worden gebruikt zonder akkoord.",consentRetry:"Opnieuw proberen"}
};

const $=id=>document.getElementById(id);
const t=k=>(T[state.currentLang]||T.en)[k]||T.en[k]||k;
const getStored=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
const setStored=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};

// ===================== HELPERS & FORMATTING =====================
function formatTime(s){if(!isFinite(s)||s<=0) return '--:--'; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60); if(h>0) return h+'h '+m+'m '+sec+'s'; if(m>0) return m+'m '+sec+'s'; return sec+'s';}

function formatSpeed(mbs){
    if (state.speedUnit === 'Mbps') {
        const mbps = mbs * 8;
        return mbps >= 1 ? mbps.toFixed(2)+' Mbps' : (mbps*1000).toFixed(0)+' Kbps';
    } else {
        return mbs >= 1 ? mbs.toFixed(2)+' MB/s' : (mbs*1024).toFixed(0)+' KB/s';
    }
}

function noCacheUrl(base,params){const u=new URL(base); if(params) Object.keys(params).forEach(k=>u.searchParams.append(k,params[k])); u.searchParams.append('_t',Date.now()+Math.random()); return u.toString();}
function flash(id){const el=$(id); if(!el) return; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');}
let toastTimer;
function toast(msg,type){const el=$('toast'); el.textContent=msg; el.className='toast show'+(type?' '+type:''); clearTimeout(toastTimer); toastTimer=setTimeout(()=>{el.className='toast'+(type?' '+type:'');},2400);}
function devLog(data){const p=$('devPanel'); if(!p) return; const ts=new Date().toLocaleTimeString(); p.textContent='['+ts+'] '+JSON.stringify(data,null,2)+'\n\n'+p.textContent;}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
function calcMOS(ping,jitter){if(!ping && !jitter) return 0; const mos=4.5-(ping*0.028)-(jitter*0.045); return Math.max(1,Math.min(4.5,mos));}
function calcConnectionScore(d,ping,jitter,bloat,stability){if(!d) return 0; const mbps=d*8; const speedScore=Math.min(100,(mbps/50)*100); const pingScore=Math.max(0,100-ping*1.2); const jitterScore=Math.max(0,100-jitter*3); const stabilityScore=stability||100; const bloatScore=Math.max(0,100-bloat*2); return Math.round(speedScore*0.40+pingScore*0.25+jitterScore*0.15+stabilityScore*0.15+bloatScore*0.05);}
function calcReadiness(d,ping,jitter,bloat){const mbps=d*8; const pingOk=ping<30?100:Math.max(0,100-(ping-30)*1.5); const jitterOk=jitter<5?100:Math.max(0,100-(jitter-5)*4); const bloatOk=bloat<30?100:Math.max(0,100-(bloat-30)*2); return {streaming:Math.min(100,Math.round((mbps/25)*100)),gaming:Math.round(pingOk*0.4+jitterOk*0.4+bloatOk*0.2),calls:Math.round(Math.min(100,(mbps/5)*100)*0.6+pingOk*0.4),download:Math.min(100,Math.round((mbps/50)*100))};}
function gradeFromScore(s){if(s>=85) return 'A+'; if(s>=75) return 'A'; if(s>=65) return 'B'; if(s>=55) return 'C'; if(s>=45) return 'D'; return 'E';}
function levelFromScore(s){if(s>=75) return 'good'; if(s>=50) return 'avg'; return 'bad';}
function setReadinessReal(pctId,fillId,val){const pctEl=$(pctId); const fillEl=$(fillId); if(pctEl) pctEl.textContent=val+'%'; if(fillEl){ fillEl.style.width=Math.max(2,val)+'%'; fillEl.setAttribute('data-level',levelFromScore(val)); }}
function updateReadinessUI(d,ping,jitter,bloat){const rd=calcReadiness(d,ping,jitter,bloat); setReadinessReal('rdStreamingPct','rdStreamingFill',rd.streaming); setReadinessReal('rdGamingPct','rdGamingFill',rd.gaming); setReadinessReal('rdCallsPct','rdCallsFill',rd.calls); setReadinessReal('rdDownloadPct','rdDownloadFill',rd.download);}
function updateScoreUI(score,d,ping,jitter,bloat){const circ=251.3; const progress=$('scoreProgress'); if(progress) progress.style.strokeDashoffset=circ*(1-score/100); $('scoreNumber').textContent=score||'--'; let gradeKey='scoreExcellent',gradeDescKey='scoreDescEmpty'; if(score>=85){gradeKey='scoreExcellent';gradeDescKey='scoreDescExcellent';} else if(score>=70){gradeKey='scoreGood';gradeDescKey='scoreDescGood';} else if(score>=50){gradeKey='scoreFair';gradeDescKey='scoreDescFair';} else if(score>0){gradeKey='scorePoor';gradeDescKey='scoreDescPoor';} $('scoreGrade').textContent=score?t(gradeKey):'--'; $('scoreDesc').textContent=t(gradeDescKey); updateReadinessUI(d,ping,jitter,bloat);}

// ===================== CONSENT & DATA FETCHING =====================
function initConsent(){
    const savedConsent = getStored(CONFIG.CONSENT_KEY);
    if(savedConsent === 'true') {
        state.consentGiven = true;
        if($('consentModal')) $('consentModal').classList.remove('active');
        startDataFetching();
    } else {
        if($('consentModal')) $('consentModal').classList.add('active');
    }
}

function setupConsentEvents(){
    const checkbox = $('consentCheckbox');
    const agreeBtn = $('consentAgree');
    const cancelBtn = $('consentCancel');

    if(checkbox && agreeBtn){
        checkbox.addEventListener('change', (e) => {
            agreeBtn.disabled = !e.target.checked;
        });
    }

    if(agreeBtn){
        agreeBtn.addEventListener('click', () => {
            setStored(CONFIG.CONSENT_KEY, 'true');
            state.consentGiven = true;
            $('consentModal').classList.remove('active');
            startDataFetching();
        });
    }

    if(cancelBtn){
        cancelBtn.addEventListener('click', () => {
            $('consentModal').classList.remove('active');
            $('closedMessage').classList.add('active');
            document.querySelector('.app').style.display = 'none';
        });
    }
}

function startDataFetching(){
    if(state.dataFetched) return;
    // نجمع البيانات فور الموافقة
    state.dataPromise = Promise.allSettled([fetchIPInfo(), collectDeviceInfo()]).then(() => {
        state.dataFetched = true;
    });
}

// ===================== IP INFO =====================
const ASN_NAMES={'AS29256':'Tarassul Internet Service Provider','AS29386':'Tarassul Internet Service Provider','AS201550':'Tarassul Internet Service Provider'};
const COUNTRY_SHORT={'Syrian Arab Republic':'Syria','United States of America':'United States','United Kingdom of Great Britain and Northern Ireland':'United Kingdom','Russian Federation':'Russia','Iran, Islamic Republic of':'Iran','Korea, Republic of':'South Korea',"Korea, Democratic People's Republic of":'North Korea','Viet Nam':'Vietnam','Czechia':'Czech Republic','Türkiye':'Turkey','Bolivia, Plurinational State of':'Bolivia','Venezuela, Bolivarian Republic of':'Venezuela','Tanzania, United Republic of':'Tanzania','Moldova, Republic of':'Moldova','Macedonia, the former Yugoslav Republic of':'North Macedonia','Palestine, State of':'Palestine','Taiwan, Province of China':'Taiwan','Congo, The Democratic Republic of the':'DR Congo',"Lao People's Democratic Republic":'Laos','Brunei Darussalam':'Brunei','Cabo Verde':'Cape Verde',"Côte d'Ivoire":'Ivory Coast','Eswatini':'Swaziland','Holy See (Vatican City State)':'Vatican City','Micronesia, Federated States of':'Micronesia','Sao Tome and Principe':'São Tomé and Príncipe','Timor-Leste':'East Timor'};
function shortCountry(name){if(!name) return ''; return COUNTRY_SHORT[name]||name;}

async function fetchIPInfo(){
    let baseInfo=null;
    try{
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),8000);
        const r=await fetch('https://ipwho.is/',{signal:controller.signal});
        clearTimeout(timeout);
        if(r.ok){
            const d=await r.json();
            if(d && d.ip){
                const conn=d.connection||{};
                baseInfo={ip:d.ip,ipType:d.type,asn:conn.asn?'AS'+String(conn.asn).replace(/^AS/i,''):null,isp:conn.isp||conn.org||null,city:d.city||null,country:d.country||null};
            }
        }
    }catch(e){}
    if(!baseInfo){
        try{
            const controller=new AbortController();
            const timeout=setTimeout(()=>controller.abort(),8000);
            const r=await fetch('https://ipapi.co/json/',{signal:controller.signal});
            clearTimeout(timeout);
            if(r.ok){
                const d=await r.json();
                if(d && d.ip){
                    baseInfo={ip:d.ip,ipType:d.version,asn:d.asn?'AS'+String(d.asn).replace(/^AS/i,''):null,isp:d.org||null,city:d.city||null,country:d.country_name||null};
                }
            }
        }catch(e){}
    }
    if(!baseInfo || !baseInfo.ip){
        ['idCardISP','idCardLocation','idCardIP','idCardIPType'].forEach(id=>{const el=$(id); if(el) el.textContent=t('netNotAvailable');});
        return;
    }
    let dbipLocation=null;
    try{
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),6000);
        const url='https://geo.wp-statistics.com/api/lookup?ip='+encodeURIComponent(baseInfo.ip)+'&db=dbip&format=json';
        const r=await fetch(url,{signal:controller.signal});
        clearTimeout(timeout);
        if(r.ok){
            const d=await r.json();
            if(d && d.city){
                dbipLocation={city:d.city,country:d.country,countryCode:d.country_code};
            }
        }
    }catch(e){}
    const city=dbipLocation?dbipLocation.city:baseInfo.city;
    const country=dbipLocation?dbipLocation.country:baseInfo.country;
    const shortName=shortCountry(country);
    const location=[city,shortName].filter(Boolean).join(', ');
    const ispName=(baseInfo.asn && ASN_NAMES[baseInfo.asn])||baseInfo.isp||'—';
    const data={isp:ispName,location:location,ip:baseInfo.ip,ipType:baseInfo.ipType};
    applyIPInfo(data);
}

function applyIPInfo(data){
    state.netInfo.isp=data.isp;
    state.netInfo.location=data.location;
    state.netInfo.ip=data.ip;
    state.netInfo.ipType=data.ipType;
    const set=(id,val)=>{const el=$(id); if(el) el.textContent=val||'-';};
    set('idCardISP',data.isp);
    set('idCardLocation',data.location);
    set('idCardIP',data.ip);
    set('idCardIPType',data.ipType?String(data.ipType).toUpperCase():'-');
}

// ===================== DEVICE INFO =====================
function parseUserAgent(ua){
    let type=t('deviceDesktop');
    if(/Mobi|Android.*Mobile|iPhone|iPod|Windows Phone/i.test(ua)) type=t('deviceMobile');
    else if(/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) type=t('deviceTablet');
    let model='';
    const androidMatch=ua.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build|\))/i);
    if(androidMatch && androidMatch[1]){
        const candidate=androidMatch[1].trim();
        if(candidate && candidate.length<30 && !/^[a-z]{2}(-[a-z]{2})?$/i.test(candidate)){ model=candidate; }
    }
    if(!model){ if(/iPhone/i.test(ua)) model='iPhone'; else if(/iPad/i.test(ua)) model='iPad'; }
    let os=t('unknown');
    if(/Windows NT/i.test(ua)) os='Windows';
    else if(/Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua)) os='macOS';
    else if(/Android/i.test(ua)){const m=ua.match(/Android\s+([\d.]+)/); os='Android'+(m?' '+m[1]:'');}
    else if(/iPhone|iPad|iPod/i.test(ua)){const m=ua.match(/OS\s+([\d_]+)/); os='iOS'+(m?' '+m[1].replace(/_/g,'.'):'');}
    else if(/Linux/i.test(ua)) os='Linux';
    let browser=t('unknown'),version='';
    if(/Edg\//i.test(ua)){browser='Edge'; version=(ua.match(/Edg\/([\d.]+)/)||[])[1]||'';}
    else if(/OPR\//i.test(ua)){browser='Opera'; version=(ua.match(/OPR\/([\d.]+)/)||[])[1]||'';}
    else if(/Chrome\//i.test(ua) && !/Edg|OPR/i.test(ua)){browser='Chrome'; version=(ua.match(/Chrome\/([\d.]+)/)||[])[1]||'';}
    else if(/Firefox\//i.test(ua)){browser='Firefox'; version=(ua.match(/Firefox\/([\d.]+)/)||[])[1]||'';}
    else if(/Safari\//i.test(ua) && !/Chrome/i.test(ua)){browser='Safari'; version=(ua.match(/Version\/([\d.]+)/)||[])[1]||'';}
    return {type,os,browser,version,model};
}

async function collectDeviceInfo(){
    const ua=navigator.userAgent;
    const parsed=parseUserAgent(ua);
    state.deviceInfo.type=parsed.type;
    state.deviceInfo.os=parsed.os;
    state.deviceInfo.browser=parsed.browser;
    state.deviceInfo.browserVer=parsed.version;
    state.deviceInfo.model=parsed.model||'—';
    state.deviceInfo.lang=navigator.language+(navigator.languages?' • '+navigator.languages.slice(0,3).join(', '):'');
    state.deviceInfo.platform=navigator.platform||t('unknown');
    state.deviceInfo.ua=ua;
    state.deviceInfo.uaArch='—'; state.deviceInfo.uaBitness='—'; state.deviceInfo.uaModel='—'; state.deviceInfo.uaPlatformVer='—';
    try{
        if(navigator.userAgentData && navigator.userAgentData.getHighEntropyValues){
            const h=await navigator.userAgentData.getHighEntropyValues(['architecture','bitness','model','platformVersion']);
            state.deviceInfo.uaArch=h.architecture||'—';
            state.deviceInfo.uaBitness=h.bitness?(h.bitness+' bit'):'—';
            state.deviceInfo.uaModel=h.model||'—';
            state.deviceInfo.uaPlatformVer=h.platformVersion||'—';
        } else {
            state.deviceInfo.uaArch=t('notSupported'); state.deviceInfo.uaBitness=t('notSupported'); state.deviceInfo.uaModel=t('notSupported'); state.deviceInfo.uaPlatformVer=t('notSupported');
        }
    }catch(e){
        state.deviceInfo.uaArch=t('notSupported'); state.deviceInfo.uaBitness=t('notSupported'); state.deviceInfo.uaModel=t('notSupported'); state.deviceInfo.uaPlatformVer=t('notSupported');
    }
    state.deviceInfo.scrRes=screen.width+' × '+screen.height;
    state.deviceInfo.scrAvail=screen.availWidth+' × '+screen.availHeight;
    state.deviceInfo.scrViewport=window.innerWidth+' × '+window.innerHeight;
    state.deviceInfo.scrDPR=window.devicePixelRatio?window.devicePixelRatio.toFixed(2):'1';
    state.deviceInfo.scrDepth=(screen.colorDepth||24)+'-bit';
    state.deviceInfo.scrOrient=(screen.orientation && screen.orientation.type)||(window.innerWidth>window.innerHeight?'landscape':'portrait');
    state.deviceInfo.scrTouch=device.isTouch?t('yes')+(navigator.maxTouchPoints?' ('+navigator.maxTouchPoints+')':''):t('no');
    state.deviceInfo.hwCPU=device.cores?String(device.cores):t('unknown');
    state.deviceInfo.hwRAM=navigator.deviceMemory?navigator.deviceMemory+' GB':t('unknown');
    try{
        if(navigator.storage && navigator.storage.estimate){
            const est=await navigator.storage.estimate();
            const quota=est.quota?(est.quota/1024/1024/1024).toFixed(2)+' GB':t('unknown');
            state.deviceInfo.hwStorage=quota;
        } else state.deviceInfo.hwStorage=t('notSupported');
    }catch(e){state.deviceInfo.hwStorage=t('notSupported');}
    try{
        if(navigator.getBattery){
            const b=await navigator.getBattery();
            state.deviceInfo.hwBattery=Math.round(b.level*100)+'%'+(b.charging?' ⚡':'');
        } else state.deviceInfo.hwBattery=t('notSupported');
    }catch(e){state.deviceInfo.hwBattery=t('notSupported');}
    try{
        const canvas=document.createElement('canvas');
        const gl=canvas.getContext('webgl')||canvas.getContext('experimental-webgl');
        if(gl){
            state.deviceInfo.gpuSupported=t('yes');
            const dbg=gl.getExtension('WEBGL_debug_renderer_info');
            if(dbg){
                state.deviceInfo.gpuVendor=gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)||t('unknown');
                state.deviceInfo.gpuRenderer=gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)||t('unknown');
            } else {
                state.deviceInfo.gpuVendor=t('notSupported'); state.deviceInfo.gpuRenderer=t('notSupported');
            }
        } else {
            state.deviceInfo.gpuSupported=t('no'); state.deviceInfo.gpuVendor='—'; state.deviceInfo.gpuRenderer='—';
        }
    }catch(e){
        state.deviceInfo.gpuSupported=t('notSupported'); state.deviceInfo.gpuVendor='—'; state.deviceInfo.gpuRenderer='—';
    }
    try{state.deviceInfo.privTZ=Intl.DateTimeFormat().resolvedOptions().timeZone||t('unknown');}catch(e){state.deviceInfo.privTZ=t('unknown');}
    state.deviceInfo.privLocale=(navigator.language||'')+(navigator.languages?' • '+navigator.languages.slice(0,2).join(', '):'');
    state.deviceInfo.privDNT=(navigator.doNotTrack==='1'||window.doNotTrack==='1')?t('yes'):(navigator.doNotTrack==='0'?t('no'):t('unknown'));
    state.deviceInfo.privCookies=navigator.cookieEnabled?t('yes'):t('no');
    try{localStorage.setItem('_t','1'); localStorage.removeItem('_t'); state.deviceInfo.privLS=t('yes');}catch(e){state.deviceInfo.privLS=t('no');}
    try{sessionStorage.setItem('_t','1'); sessionStorage.removeItem('_t'); state.deviceInfo.privSS=t('yes');}catch(e){state.deviceInfo.privSS=t('no');}
    let fpScore=0;
    const signals=[];
    if(state.deviceInfo.gpuVendor && state.deviceInfo.gpuVendor!==t('notSupported') && state.deviceInfo.gpuVendor!=='—'){fpScore+=18; signals.push('WebGL');}
    if(state.deviceInfo.gpuRenderer && state.deviceInfo.gpuRenderer!==t('notSupported') && state.deviceInfo.gpuRenderer!=='—'){fpScore+=10; signals.push('GPU');}
    if(navigator.hardwareConcurrency){fpScore+=8; signals.push('CPU');}
    if(navigator.deviceMemory){fpScore+=8; signals.push('RAM');}
    if(state.deviceInfo.privTZ){fpScore+=10; signals.push('TZ');}
    if(navigator.languages && navigator.languages.length){fpScore+=6; signals.push('Lang');}
    if(state.deviceInfo.scrRes){fpScore+=6; signals.push('Screen');}
    if(state.deviceInfo.scrDepth){fpScore+=4; signals.push('Color');}
    if(navigator.platform){fpScore+=6; signals.push('Platform');}
    if(navigator.connection){fpScore+=6; signals.push('Net');}
    if(navigator.getBattery) fpScore+=6; else fpScore+=4;
    state.deviceInfo.fpScore=Math.min(100,fpScore);
    state.deviceInfo.fpSignals=signals;
    state.deviceLoaded=true;
    renderDeviceInfo();
}

function renderDeviceInfo(){
    if(!state.deviceLoaded) return;
    const d=state.deviceInfo;
    const set=(id,val)=>{const el=$(id); if(el) el.textContent=val||'-';};
    set('devType',d.type); set('devModel',d.model); set('devOS',d.os); set('devBrowser',d.browser); set('devBrowserVer',d.browserVer);
    set('devLang',d.lang); set('devPlatform',d.platform);
    set('devUA',d.ua);
    set('uaArch',d.uaArch); set('uaBitness',d.uaBitness); set('uaModel',d.uaModel); set('uaPlatformVer',d.uaPlatformVer);
    set('scrRes',d.scrRes); set('scrAvail',d.scrAvail); set('scrViewport',d.scrViewport); set('scrDPR',d.scrDPR);
    set('scrDepth',d.scrDepth); set('scrOrient',d.scrOrient); set('scrTouch',d.scrTouch);
    set('hwCPU',d.hwCPU); set('hwRAM',d.hwRAM); set('hwStorage',d.hwStorage); set('hwBattery',d.hwBattery);
    set('gpuSupported',d.gpuSupported); set('gpuVendor',d.gpuVendor); set('gpuRenderer',d.gpuRenderer);
    set('privTZ',d.privTZ); set('privLocale',d.privLocale); set('privDNT',d.privDNT);
    set('privCookies',d.privCookies); set('privLS',d.privLS); set('privSS',d.privSS);
    const fp=d.fpScore||0;
    const fpFill=$('fpFill');
    if(fpFill){const circ=176; fpFill.style.strokeDashoffset=circ*(1-fp/100);}
    const fpNum=$('fpNum'); if(fpNum) fpNum.textContent=fp;
    const fpLevel=$('fpLevel'),fpDesc=$('fpDesc');
    let levelKey,levelDesc,levelClass;
    if(fp<45){levelKey='fpLevelLow'; levelDesc='fpDescLow'; levelClass='low';}
    else if(fp<70){levelKey='fpLevelMid'; levelDesc='fpDescMid'; levelClass='mid';}
    else {levelKey='fpLevelHigh'; levelDesc='fpDescHigh'; levelClass='high';}
    if(fpLevel) fpLevel.textContent=t(levelKey);
    if(fpDesc) fpDesc.textContent=t(levelDesc);
    if(fpFill) fpFill.setAttribute('data-level',levelClass);
    const signalsWrap=$('fpSignals');
    if(signalsWrap){ signalsWrap.innerHTML=(d.fpSignals||[]).map(s=>'<span class="fp-signal">'+escapeHtml(s)+'</span>').join(''); }
}

function updateNetworkInfo(){
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    let effText=t('ntUnsupported');
    if(c && c.effectiveType){
        const map={'slow-2g':t('nt2gSlow'),'2g':t('nt2g'),'3g':t('nt3g'),'4g':t('nt4g')};
        effText=map[c.effectiveType]||c.effectiveType;
    }
    state.netInfo.effectType=effText;
    if($('idCardEffectType')) $('idCardEffectType').textContent=effText;
    let connType=t('unknown');
    if(c && c.type){
        if(c.type==='wifi') connType=t('wifi');
        else if(c.type==='cellular') connType=t('cellular');
        else if(c.type==='ethernet') connType=t('ethernet');
        else connType=c.type;
    } else if(c && c.effectiveType){ connType=t('cellular'); }
    else { connType=t('notSupported'); }
    state.netInfo.connType=connType;
    if($('idCardConnType')) $('idCardConnType').textContent=connType;
}

// ===================== GRAPH =====================
let graphPending=false,graphHoverIdx=-1;
function resizeCanvas(){const c=$('graph'); if(!c) return null; const wrap=c.parentElement; const rect=wrap.getBoundingClientRect(); const dpr=Math.min(window.devicePixelRatio||1, device.isLowEnd?1:2); const w=Math.max(rect.width,1),h=Math.max(rect.height,1); if(c.width!==w*dpr||c.height!==h*dpr){c.width=w*dpr; c.height=h*dpr;} return {ctx:c.getContext('2d'),w,h,dpr};}
function drawGraph(){if(graphPending) return; graphPending=true; requestAnimationFrame(()=>{graphPending=false; _drawGraph();});}
function _drawGraph(){
    const g=resizeCanvas(); if(!g) return;
    const ctx=g.ctx,w=g.w,h=g.h;
    ctx.setTransform(g.dpr,0,0,g.dpr,0,0); ctx.clearRect(0,0,w,h);
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light' && document.documentElement.getAttribute('data-theme') !== 'pastel';
    const padL=8,padR=42,padT=20,padB=20;
    const plotW=w-padL-padR,plotH=h-padT-padB;
    const textDim = isDark ? 'rgba(156,163,175,0.9)' : 'rgba(107,114,128,1)';
    const gridLine = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    const strokeC1 = '#1D4ED8'; 
    const strokeC2 = '#1D4ED8'; 
    const isMbps = state.speedUnit === 'Mbps';
    const multiplier = isMbps ? 8 : 1;
    const displayUnit = isMbps ? 'Mbps' : 'MB/s';
    let peak=0;
    for(let i=0;i<state.speeds.length;i++) if(state.speeds[i]>peak) peak=state.speeds[i];
    for(let i=0;i<state.previousSpeeds.length;i++) if(state.previousSpeeds[i]>peak) peak=state.previousSpeeds[i];
    const effectiveMax=Math.max(state.currentMax,peak*1.15,0.05) * multiplier;
    if($('graphLabel')) $('graphLabel').textContent = effectiveMax < 1 && !isMbps ? 'KB/s' : displayUnit;
    const rows=4;
    ctx.font='500 10px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign='right'; ctx.textBaseline='middle';
    for(let i=0;i<=rows;i++){
        const y=padT+plotH*(i/rows); 
        ctx.strokeStyle=gridLine; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke(); 
        const val=effectiveMax*(1-i/rows); 
        ctx.fillStyle=textDim; 
        const lbl=val>=1?val.toFixed(val>=10?0:1):(val*1024).toFixed(0); 
        ctx.fillText(lbl,w-8,y);
    }
    ctx.textAlign='center'; ctx.textBaseline='top';
    const sampleSec=CONFIG.UI_UPDATE_INTERVAL/1000;
    for(let i=0;i<=3;i++){
        const x=padL+plotW*(i/3); const tSec=state.duration*(i/3); ctx.fillStyle=textDim; ctx.fillText(tSec.toFixed(1)+'s',x,padT+plotH+8);
    }
    if(state.speeds.length<2 && state.previousSpeeds.length<2){
        if($('graphEmpty')) $('graphEmpty').classList.toggle('hidden', state.speeds.length>0||state.previousSpeeds.length>0); return;
    }
    if($('graphEmpty')) $('graphEmpty').classList.add('hidden');
    if(state.previousSpeeds.length>1){
        const prevPts=state.previousSpeeds.map((s,i)=>{
            const tSec=i*sampleSec; const val = s * multiplier;
            return {x:padL+Math.min(tSec/state.duration,1)*plotW, y:padT+plotH-Math.min((val/effectiveMax)*plotH,plotH)};
        }).filter(p=>p.x<=padL+plotW);
        if(prevPts.length>1){
            ctx.save(); ctx.beginPath(); ctx.moveTo(prevPts[0].x,prevPts[0].y);
            for(let i=1;i<prevPts.length;i++){const p=prevPts[i-1],cc=prevPts[i]; const cx=(p.x+cc.x)/2; ctx.bezierCurveTo(cx,p.y,cx,cc.y,cc.x,cc.y);}
            ctx.strokeStyle='#10B981'; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.setLineDash([5,5]); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
        }
    }
    if(state.speeds.length>1){
        const pts=state.speeds.map((s,i)=>{
            const tSec=i*sampleSec; const val = s * multiplier;
            return {x:padL+Math.min(tSec/state.duration,1)*plotW, y:padT+plotH-Math.min((val/effectiveMax)*plotH,plotH)};
        });
        const buildPath=()=>{
            ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
            for(let i=1;i<pts.length;i++){const p=pts[i-1],cc=pts[i]; const cx=(p.x+cc.x)/2; ctx.bezierCurveTo(cx,p.y,cx,cc.y,cc.x,cc.y);}
        };
        const grad=ctx.createLinearGradient(0,padT,0,padT+plotH);
        grad.addColorStop(0, 'rgba(29,78,216,0.25)'); grad.addColorStop(1, 'rgba(29,78,216,0)'); 
        buildPath(); ctx.lineTo(pts[pts.length-1].x,padT+plotH); ctx.lineTo(pts[0].x,padT+plotH); ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
        ctx.save(); ctx.shadowColor=strokeC1; ctx.shadowBlur=12; buildPath();
        const lineGrad=ctx.createLinearGradient(padL,0,padL+plotW,0); lineGrad.addColorStop(0,strokeC2); lineGrad.addColorStop(1,strokeC1);
        ctx.strokeStyle=lineGrad; ctx.lineWidth=3; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke(); ctx.restore();
        const last=pts[pts.length-1];
        ctx.beginPath(); ctx.arc(last.x,last.y,8,0,Math.PI*2); ctx.fillStyle='rgba(29,78,216,0.2)'; ctx.fill();
        ctx.beginPath(); ctx.arc(last.x,last.y,4,0,Math.PI*2); ctx.fillStyle=strokeC1; ctx.fill();
        ctx.beginPath(); ctx.arc(last.x,last.y,2,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
    }
    if(graphHoverIdx>=0 && graphHoverIdx<state.speeds.length && state.speeds.length>1){
        const tSec=graphHoverIdx*sampleSec;
        const hpX=padL+Math.min(tSec/state.duration,1)*plotW;
        const val = state.speeds[graphHoverIdx] * multiplier;
        const hpY=padT+plotH-Math.min((val/effectiveMax)*plotH,plotH);
        ctx.save(); ctx.strokeStyle='rgba(29,78,216,0.3)'; ctx.lineWidth=1; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(hpX,padT); ctx.lineTo(hpX,padT+plotH); ctx.stroke(); ctx.restore();
    }
}
function handleGraphHover(ev){
    if(state.speeds.length<2) return;
    const c=$('graph'); const rect=c.getBoundingClientRect();
    const x=(ev.touches?ev.touches[0].clientX:ev.clientX)-rect.left;
    const padL=8,padR=42; const plotW=rect.width-padL-padR;
    const rel=Math.max(0,Math.min(1,(x-padL)/plotW));
    const targetT=rel*state.duration;
    graphHoverIdx=Math.round(targetT/(CONFIG.UI_UPDATE_INTERVAL/1000));
    graphHoverIdx=Math.max(0,Math.min(state.speeds.length-1,graphHoverIdx));
    const tip=$('graphTip'); const speed=state.speeds[graphHoverIdx]; const tSec=graphHoverIdx*(CONFIG.UI_UPDATE_INTERVAL/1000);
    if($('ttSpeed')) $('ttSpeed').textContent=formatSpeed(speed);
    if($('ttTime')) $('ttTime').textContent=tSec.toFixed(1)+'s';
    const xPx=padL+(tSec/state.duration)*plotW;
    if(tip){ tip.style.left=xPx+'px'; tip.style.top='6px'; tip.classList.add('show'); }
    drawGraph();
}
function hideGraphTip(){graphHoverIdx=-1; const tip=$('graphTip'); if(tip) tip.classList.remove('show'); drawGraph();}

function setSpeed(mbs){
    const v=$('speed'),u=$('statusUnit'); 
    if(!v||!u) return; 
    if (state.speedUnit === 'Mbps') {
        const mbps = mbs * 8;
        v.textContent = mbps >= 1 ? mbps.toFixed(2) : (mbps * 1000).toFixed(0);
        u.textContent = mbps >= 1 ? 'Mbps' : 'Kbps';
    } else {
        v.textContent = mbs >= 1 ? mbs.toFixed(2) : (mbs * 1024).toFixed(0);
        u.textContent = mbs >= 1 ? 'MB/s' : 'KB/s';
    }
}
function setSpeedColor(mbs){ /* CSS handles it */ }
function setQuality(level,text){const q=$('quality'),qt=$('qualityText'); if(!q||!qt) return; qt.textContent=text; q.removeAttribute('data-level'); if(level) q.setAttribute('data-level',level);}
function setStatus(text,dotClass){const st=$('statusText'); if(st) st.textContent=text; const dot=$('liveDot'); if(dot) dot.className='live-dot'+(dotClass?' '+dotClass:'');}
function setWarmup(active){const el=$('warmupIndicator'); if(!el) return; if(active) el.classList.add('active'); else el.classList.remove('active');}

function getCustomSizeMB(){const sizeInput=$('sizeInput'); const sizeUnit=$('sizeUnit'); if(!sizeInput || !sizeUnit) return 0; const val=parseFloat(sizeInput.value)||0; const mult=parseFloat(sizeUnit.value)||1; return val*mult;}
function updateCalculators(speedMB){if(speedMB<=0) return; const t1=$('time1gb'); if(t1) t1.textContent=formatTime(1024/speedMB); const sizeMB=getCustomSizeMB(); const ct=$('customTime'); if(!ct) return; if(sizeMB>0) ct.textContent=formatTime(sizeMB/speedMB); else ct.textContent='--:--';}

function calcScores(dMbs,ping,jitter,bloat){
    const qText=dMbs>10?t('qGood'):dMbs>3?t('qAvg'):t('qBad');
    const qLevel=dMbs>10?'good':dMbs>3?'avg':'bad';
    setQuality(qLevel,qText);
    if($('scoreStream')) $('scoreStream').textContent=dMbs>25?t('st4k'):dMbs>10?t('stHd'):dMbs>3?t('stSd'):t('stBad');
    const totalLat=ping+jitter+bloat;
    if($('scoreGaming')) $('scoreGaming').textContent=totalLat<50?t('gPro'):totalLat<100?t('gStab'):t('gLag');
    if($('scoreCalls')) $('scoreCalls').textContent=(dMbs>5&&ping<100)?t('cExcel'):(dMbs>2)?t('cGood'):t('cBad');
    const mbps=dMbs*8;
    if($('videoSpeed')) $('videoSpeed').textContent=mbps.toFixed(1)+' Mbps';
    let res='';
    if(mbps>=25) res='2160p (4K), 1080p, 720p';
    else if(mbps>=5) res='1080p (Full HD), 720p';
    else if(mbps>=2.5) res='720p (HD), 480p';
    else if(mbps>=1) res='480p, 360p';
    else res='240p, 144p';
    if($('videoResolution')) $('videoResolution').textContent=res;
}

async function acquireWakeLock(){try{if('wakeLock' in navigator) state.wakeLock=await navigator.wakeLock.request('screen');}catch(e){}}
function releaseWakeLock(){try{if(state.wakeLock) state.wakeLock.release();}catch(e){} state.wakeLock=null;}

// ===================== TEST ENGINE (ORIGINAL) =====================
async function runPingTest(){
    const arr=[];
    try{await fetch(noCacheUrl(CONFIG.PING_URL),{cache:'no-store',priority:'high'});}catch(e){}
    for(let i=0;i<CONFIG.PING_COUNT;i++){
        if(state.stopRequested) break;
        const s=performance.now();
        try{await fetch(noCacheUrl(CONFIG.PING_URL),{cache:'no-store',priority:'high'}); arr.push(performance.now()-s);}catch(e){}
    }
    const avg=arr.length?arr.reduce((a,b)=>a+b)/arr.length:0;
    const jit=arr.length?Math.sqrt(arr.map(x=>(x-avg)**2).reduce((a,b)=>a+b)/arr.length):0;
    state.basePingMs=avg;
    return {ping:Math.round(avg),jitter:Math.round(jit)};
}

async function runDownloadTest(seconds){
    const start=performance.now();
    const controller=new AbortController();
    let bytes=0,isAborted=false;
    state.currentMax=0.5;
    state.speeds=[];
    const bloatController=new AbortController();
    const activePings=[];
    let bloatLock=false;
    const bloatInterval=setInterval(async()=>{
        if(bloatLock||isAborted||state.stopRequested) return;
        bloatLock=true;
        const ts=performance.now();
        try{await fetch(noCacheUrl(CONFIG.PING_URL),{cache:'no-store',signal:bloatController.signal}); activePings.push(performance.now()-ts);}catch(e){}
        bloatLock=false;
    },CONFIG.BLOAT_CHECK_INTERVAL);
    const timeout=setTimeout(()=>{isAborted=true; try{controller.abort();}catch(e){} try{bloatController.abort();}catch(e){} clearInterval(bloatInterval);},seconds*1000);
    const dlPromise=(async()=>{
        try{
            const r=await fetch(noCacheUrl(CONFIG.DOWNLOAD_URL,{bytes:CONFIG.DOWNLOAD_CHUNK_SIZE}),{cache:'no-store',signal:controller.signal});
            const reader=r.body.getReader();
            while(!isAborted && !state.stopRequested){const {done,value}=await reader.read(); if(done||isAborted||state.stopRequested) break; bytes+=value.length;}
        }catch(e){}
    })();
    const uiLoop=setInterval(()=>{
        if((isAborted||state.stopRequested)&&bytes===0){clearInterval(uiLoop); return;}
        const elapsed=(performance.now()-start)/1000;
        const speedMB=elapsed>0?bytes/(1024*1024*elapsed):0;
        if(speedMB>state.currentMax*0.8) state.currentMax=speedMB*1.5;
        setSpeed(speedMB);
        updateCalculators(speedMB);
        state.speeds.push(speedMB);
        if(state.speeds.length>CONFIG.GRAPH_MAX_POINTS) state.speeds.shift();
        drawGraph();
        const left=Math.max(0,Math.ceil(seconds-elapsed));
        setStatus(t('downing')+' • '+left+'s','running');
        if(isAborted||state.stopRequested) clearInterval(uiLoop);
    },CONFIG.UI_UPDATE_INTERVAL);
    setWarmup(true);
    const warmupTimeout=setTimeout(()=>setWarmup(false),3000);
    await dlPromise;
    clearInterval(uiLoop); clearInterval(bloatInterval); clearTimeout(timeout); clearTimeout(warmupTimeout);
    setWarmup(false);
    try{bloatController.abort();}catch(e){}
    if(state.stopRequested) throw new Error('stopped');
    const totalTime=(performance.now()-start)/1000;
    const finalSpeedMB=bytes/(1024*1024*totalTime);
    state.lastFinalSpeed=finalSpeedMB;
    const avg=state.speeds.length?state.speeds.reduce((a,b)=>a+b,0)/state.speeds.length:0;
    const stdev=state.speeds.length?Math.sqrt(state.speeds.map(x=>(x-avg)**2).reduce((a,b)=>a+b,0)/state.speeds.length):0;
    const stability=Math.max(0,100-(stdev/(avg||1)*100));
    const noise=(stdev/(avg||1)*10).toFixed(1);
    const jitterPct=((stdev/(avg||1))*100).toFixed(1);
    const avgBloat=activePings.length?activePings.reduce((a,b)=>a+b,0)/activePings.length:state.basePingMs;
    const bloatDiff=Math.max(0,Math.round(avgBloat-state.basePingMs));
    if(bytes===0) throw new Error(t('testFailed'));
    return {speed:finalSpeedMB,stability:stability.toFixed(0),bloat:bloatDiff,noise,jitterPct};
}

function runUploadTest(seconds){
    return new Promise((resolve)=>{
        let resolved=false;
        const safeResolve=(val)=>{if(resolved)return;resolved=true;resolve(val);};
        try{
            const start=performance.now();
            const chunkSize=CONFIG.UPLOAD_CHUNK_SIZE;
            const data=new Uint8Array(chunkSize);
            for(let i=0;i<chunkSize;i++)data[i]=(Math.random()*256)|0;
            const blob=new Blob([data],{type:'application/octet-stream'});
            let totalBytes=0,currentXHR=null,isFinished=false;
            try{setStatus(t('uping')+' • 0%','running');}catch(e){}
            function finish(){
                if(isFinished)return;
                isFinished=true;
                try{clearTimeout(timer);}catch(e){}
                try{
                    const totalTime=(performance.now()-start)/1000;
                    const finalTime=Math.max(totalTime,1);
                    const speedMBps=totalBytes>0?totalBytes/(finalTime*1024*1024):0;
                    state.results.upload=Number(speedMBps.toFixed(2));
                    const el=$('up');
                    if(el){el.textContent=formatSpeed(speedMBps);}
                    try{flash('up');}catch(e){}
                    safeResolve(speedMBps);
                }catch(e){state.results.upload=0;safeResolve(0);}
            }
            const timer=setTimeout(()=>{try{if(currentXHR)currentXHR.abort();}catch(e){}finish();},seconds*1000);
            function uploadChunk(){
                if(isFinished||state.stopRequested){finish();return;}
                if(performance.now()-start>=seconds*1000){finish();return;}
                try{
                    currentXHR=new XMLHttpRequest();
                    currentXHR.open('POST',CONFIG.UPLOAD_URL,true);
                    currentXHR.timeout=10000;
                    let lastLoaded=0;
                    currentXHR.upload.onprogress=(e)=>{
                        if(e.loaded>lastLoaded){totalBytes+=(e.loaded-lastLoaded);lastLoaded=e.loaded;}
                        try{const elapsed=(performance.now()-start)/1000;const pct=Math.min(99,Math.floor((elapsed/seconds)*100));setStatus(t('uping')+' • '+pct+'%','running');}catch(e){}
                    };
                    currentXHR.onload=()=>{if(isFinished||state.stopRequested)return;if(currentXHR.status>=200&&currentXHR.status<300)uploadChunk();else finish();};
                    currentXHR.onerror=()=>finish();
                    currentXHR.onabort=()=>finish();
                    currentXHR.ontimeout=()=>finish();
                    currentXHR.send(blob);
                }catch(e){finish();}
            }
            uploadChunk();
        }catch(e){state.results.upload=0;safeResolve(0);}
    });
}

function stopTest(){
    if(!state.isRunning) return;
    state.stopRequested=true;
    try{releaseWakeLock();}catch(e){}
    const powerBtn=$('powerBtn'); if(powerBtn) powerBtn.disabled=true;
    devLog({status:'Test stopped by user'});
}

async function startTest(){
    if(state.isRunning) return;
    
    // إذا لم يتم جمع البيانات بعد، ننتظر
    if (!state.dataFetched) {
        setStatus(t('conn'), 'running');
        const btn = $('btnStart');
        const originalText = btn.querySelector('#ctaText').textContent;
        btn.querySelector('#ctaText').textContent = t('conn');
        btn.disabled = true;
        
        await state.dataPromise;
        
        btn.disabled = false;
        btn.querySelector('#ctaText').textContent = originalText;
        setStatus(t('ready'), '');
    }

    state.isRunning=true;
    state.stopRequested=false;
    if(state.speeds.length>3){
        state.previousSpeeds=state.speeds.slice();
        try{sessionStorage.setItem(CONFIG.PREV_SPEEDS_KEY, JSON.stringify(state.previousSpeeds));}catch(e){}
    }
    const btn=$('btnStart'),ctaText=$('ctaText'),fab=$('fab'),powerBtn=$('powerBtn');
    if(btn){ btn.disabled=true; btn.classList.add('running'); }
    if(ctaText) ctaText.textContent=t('running');
    if(fab) fab.classList.add('running');
    if(powerBtn) powerBtn.disabled=false;
    state.tag=($('tagInput')?$('tagInput').value:'').trim();
    state.speeds=[]; state.lastFinalSpeed=0;
    setSpeed(0); setSpeedColor(0);
    setStatus(t('conn'),'running');
    setQuality(null,t('qNone'));
    ['scoreGaming','scoreStream','scoreCalls','videoSpeed','videoResolution','up','ping','jitter','down'].forEach(id=>{const el=$(id); if(el) el.textContent='-';});
    if($('downDiff')){ $('downDiff').textContent=''; $('downDiff').className='qs-diff'; }
    await acquireWakeLock();
    try{
        devLog({status:'Ping test started'});
        const pj=await runPingTest();
        if(state.stopRequested) throw new Error('stopped');
        if($('ping')) $('ping').textContent=pj.ping+' ms';
        if($('jitter')) $('jitter').textContent=pj.jitter+' ms';
        flash('ping'); flash('jitter');
        state.results.ping=pj.ping; state.results.jitter=pj.jitter;
        const mos=calcMOS(pj.ping,pj.jitter);
        state.results.mos=Number(mos.toFixed(1));
        if($('mos')) $('mos').textContent=mos.toFixed(1);
        devLog({status:'Download started',duration:state.duration+'s'});
        const d=await runDownloadTest(state.duration);
        if($('down')) $('down').textContent=formatSpeed(d.speed);
        if($('stability')) $('stability').textContent=d.stability+'%';
        if($('bufferbloat')) $('bufferbloat').textContent='+'+d.bloat+' ms';
        if($('noise')) $('noise').textContent=d.noise+' dB';
        if($('jitterPct')) $('jitterPct').textContent=d.jitterPct+'%';
        flash('down');
        state.results.download=Number(d.speed.toFixed(2));
        state.results.bufferbloat=d.bloat;
        state.results.stability=Number(d.stability);
        state.results.noise=Number(d.noise);
        state.results.jitterPct=Number(d.jitterPct);
        devLog({status:'Upload started'});
        try{ await runUploadTest(15); }catch(upErr){ devLog({uploadError:upErr.message}); state.results.upload=state.results.upload||0; }
        if(state.stopRequested) throw new Error('stopped');
        const score=calcConnectionScore(state.results.download,state.results.ping,state.results.jitter,state.results.bufferbloat,state.results.stability);
        state.results.score=score; state.score=score;
        updateScoreUI(score,state.results.download,state.results.ping,state.results.jitter,state.results.bufferbloat);
        updateReadinessUI(state.results.download,state.results.ping,state.results.jitter,state.results.bufferbloat);
        const grade=gradeFromScore(score);
        if($('idCardBadge')) $('idCardBadge').textContent=grade;
        if($('idCardGrade')) $('idCardGrade').textContent=grade;
        if($('idCardSpeed')) $('idCardSpeed').textContent=formatSpeed(state.results.download);
        const prev=getHistory()[0];
        if(prev && typeof prev.download==='number' && $('downDiff')){
            const diff=state.results.download-prev.download;
            if(Math.abs(diff)>=0.05){$('downDiff').textContent=(diff>0?'▲ +':'▼ ')+formatSpeed(Math.abs(diff)); $('downDiff').className='qs-diff '+(diff>0?'up':'down');}
        }
        setSpeed(d.speed); setSpeedColor(d.speed); updateCalculators(d.speed); calcScores(d.speed,pj.ping,pj.jitter,d.bloat);
        setStatus(t('done'),'');
        if(btn){ btn.classList.remove('running'); btn.classList.add('done'); }
        if(ctaText) ctaText.textContent=t('done');
        state.results.timestamp=new Date().toISOString();
        addHistory({id:Date.now(),tag:state.tag,timestamp:state.results.timestamp,download:state.results.download,upload:state.results.upload,ping:state.results.ping,jitter:state.results.jitter,bufferbloat:state.results.bufferbloat,stability:state.results.stability,noise:state.results.noise,jitterPct:state.results.jitterPct,mos:state.results.mos,score:state.results.score});
        devLog({status:'Test complete',results:state.results});
        setTimeout(()=>{if(btn){btn.classList.remove('done');} if(ctaText){ctaText.textContent=t('btnStart');}},2500);
    }catch(e){
        if(state.stopRequested || e.message==='stopped'){ devLog({status:'Test aborted'}); setStatus(t('stopped'),''); }
        else { setStatus(t('err'),''); devLog({error:e.message}); toast(t('testFailed'),'error'); }
        if(btn) btn.classList.remove('running'); if(ctaText) ctaText.textContent=t('btnStart');
    }
    releaseWakeLock();
    if(btn) btn.disabled=false; state.isRunning=false; state.stopRequested=false; if(fab) fab.classList.remove('running');
    if(powerBtn) powerBtn.disabled=true;
}

// ===================== EXPORT & SHARE =====================
function buildReportText(){
    const r=state.results;
    return '⚡ TECHOVIA SPEED TEST\n━━━━━━━━━━━━━━━━\n⬇ Download: '+formatSpeed(r.download)+'\n⬆ Upload: '+formatSpeed(r.upload)+'\n⏱ Ping: '+r.ping+' ms\n〰 Jitter: '+r.jitter+' ms\n📊 Bufferbloat: +'+r.bufferbloat+' ms\n📈 Stability: '+r.stability+'%\n🎚 MOS: '+r.mos+'\n🏆 Score: '+(r.score||0)+'/100\n🕒 '+(r.timestamp||new Date().toISOString());
}
async function shareText(){
    if(!state.results.timestamp) return toast(t('noReport'),'error');
    const text=buildReportText();
    if(navigator.share){try{await navigator.share({title:'Techovia Speed Test',text}); return;}catch(e){}}
    try{await navigator.clipboard.writeText(text); toast(t('copied'),'success');}catch(e){toast(t('copyFailed'),'error');}
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();}
async function generateShareImage(){
    const W=1080,H=1350;
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    const bg=ctx.createLinearGradient(0,0,0,H); bg.addColorStop(0,'#05080f'); bg.addColorStop(1,'#0A1628'); ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    const rg=ctx.createRadialGradient(W/2,420,0,W/2,420,700); rg.addColorStop(0,'rgba(29,78,216,0.32)'); rg.addColorStop(1,'rgba(29,78,216,0)'); ctx.fillStyle=rg; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#1D4ED8'; ctx.lineWidth=12; ctx.beginPath(); ctx.arc(W/2,180,60,0,Math.PI*2); ctx.stroke();
    ctx.lineWidth=10; ctx.beginPath(); ctx.arc(W/2,180,44,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#1D4ED8';
    ctx.beginPath(); ctx.moveTo(W/2,90); ctx.lineTo(W/2+8,165); ctx.lineTo(W/2,230); ctx.lineTo(W/2-8,165); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W/2-60,130); ctx.quadraticCurveTo(W/2-75,180,W/2-40,230); ctx.quadraticCurveTo(W/2-55,180,W/2-45,130); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W/2+60,130); ctx.quadraticCurveTo(W/2+75,180,W/2+40,230); ctx.quadraticCurveTo(W/2+55,180,W/2+45,130); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#F9FAFB'; ctx.font='bold 34px "Space Grotesk", system-ui, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('TECHOVIA SPEED TEST',W/2,320);
    const speedStr = state.speedUnit === 'Mbps' ? (state.results.download * 8).toFixed(2) : state.results.download.toFixed(2);
    const unitStr = state.speedUnit === 'Mbps' ? 'Mbps' : 'MB/s';
    ctx.fillStyle='#ffffff'; ctx.font='bold 160px "Space Grotesk", system-ui, sans-serif'; ctx.fillText(speedStr,W/2,500);
    ctx.fillStyle='#3B82F6'; ctx.font='bold 32px "Space Grotesk", system-ui, sans-serif'; ctx.fillText(unitStr,W/2,610);
    const score=state.results.score||0; const grade=gradeFromScore(score);
    ctx.fillStyle=score>=75?'#10B981':score>=50?'#F59E0B':'#1D4ED8'; ctx.font='bold 26px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText('GRADE '+grade+' • '+score+'/100',W/2,680);
    const metrics=[
        {l:'DOWNLOAD',v:formatSpeed(state.results.download)},
        {l:'UPLOAD',v:formatSpeed(state.results.upload)},
        {l:'PING',v:state.results.ping+' ms'},
        {l:'JITTER',v:state.results.jitter+' ms'}
    ];
    const cardW=220,cardH=150,gap=24; const gridW=cardW*2+gap; const startX=(W-gridW)/2; const startY=780;
    metrics.forEach((m,i)=>{
        const col=i%2,row=Math.floor(i/2);
        const x=startX+col*(cardW+gap); const y=startY+row*(cardH+gap);
        ctx.fillStyle='rgba(29,78,216,0.08)'; roundRect(ctx,x,y,cardW,cardH,20); ctx.fill();
        ctx.strokeStyle='rgba(29,78,216,0.20)'; ctx.lineWidth=2; roundRect(ctx,x,y,cardW,cardH,20); ctx.stroke();
        ctx.fillStyle='#9CA3AF'; ctx.font='bold 18px "Space Grotesk", system-ui, sans-serif'; ctx.fillText(m.l,x+cardW/2,y+45);
        ctx.fillStyle='#F9FAFB'; ctx.font='bold 44px "Space Grotesk", system-ui, sans-serif'; ctx.fillText(m.v,x+cardW/2,y+100);
    });
    const date=new Date(state.results.timestamp||Date.now());
    ctx.fillStyle='#6B7280'; ctx.font='500 18px "Space Grotesk", system-ui, sans-serif'; ctx.fillText(date.toLocaleString(),W/2,H-60);
    if(state.tag){ctx.fillStyle='#3B82F6'; ctx.font='bold 22px "Space Grotesk", system-ui, sans-serif'; ctx.fillText('#'+state.tag,W/2,H-110);}
    return new Promise(res=>c.toBlob(res,'image/png',0.95));
}
async function shareImage(){
    if(!state.results.timestamp) return toast(t('noReport'),'error');
    toast(t('imgCreating'));
    const blob=await generateShareImage();
    if(!blob) return toast(t('imgFailed'),'error');
    const file=new File([blob],'techovia-result.png',{type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:'Techovia Result'}); return;}catch(e){}}
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='techovia_'+Date.now()+'.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    toast(t('imgSaved'),'success');
}
async function copyReport(){
    if(!state.results.timestamp) return toast(t('noReport'),'error');
    try{await navigator.clipboard.writeText(buildReportText()); toast(t('copied'),'success');}catch(e){toast(t('copyFailed'),'error');}
}
function exportJSON(){
    if(!state.results.timestamp) return toast(t('noReport'),'error');
    const data=JSON.stringify(state.results,null,2);
    const blob=new Blob([data],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='techovia_report_'+Date.now()+'.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
}

// ===================== HISTORY & TRENDS =====================
function getHistory(){try{return JSON.parse(getStored(CONFIG.HISTORY_KEY)||'[]');}catch(e){return [];}}
function saveHistory(h){setStored(CONFIG.HISTORY_KEY, JSON.stringify(h.slice(0,CONFIG.HISTORY_MAX)));}
function addHistory(entry){const h=getHistory(); h.unshift(entry); saveHistory(h); renderHistory(); renderTrends();}
function deleteHistory(id){const h=getHistory().filter(e=>e.id!==id); saveHistory(h); renderHistory(); renderTrends();}
function clearHistory(){if(!confirm(t('confirmClear'))) return; try{localStorage.removeItem(CONFIG.HISTORY_KEY);}catch(e){} renderHistory(); renderTrends();}
function renderHistory(){
    const list=$('historyList'); if(!list) return;
    const h=getHistory();
    if(!h.length){list.innerHTML='<div class="history-empty">'+t('noHistory')+'</div>'; return;}
    const loc=state.currentLang==='ar'?'ar':'en';
    list.innerHTML=h.map(e=>{
        const d=new Date(e.timestamp);
        const when=d.toLocaleDateString(loc,{month:'short',day:'numeric'})+' '+d.toLocaleTimeString(loc,{hour:'2-digit',minute:'2-digit'});
        const score=e.score||0; const grade=score?gradeFromScore(score):'--'; const level=levelFromScore(score);
        const tagHtml=e.tag?'<span class="history-tag">'+escapeHtml(e.tag)+'</span>':'<span class="history-tag empty">'+t('noTag')+'</span>';
        const dl=formatSpeed(e.download);
        const up=formatSpeed(e.upload||0);
        return '<div class="history-item"><button class="history-item-del" data-del="'+e.id+'" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button><div class="history-avatar" data-grade="'+level+'">'+grade+'</div><div class="history-main">'+tagHtml+'<div class="history-meta"><span class="history-meta-item">⏱ <b>'+e.ping+'ms</b></span><span class="history-meta-item">⬆ <b>'+up+'</b></span><span class="history-meta-item">🎚 <b>'+(e.mos||'-')+'</b></span></div></div><div class="history-right"><span class="history-speed">'+dl+'</span><span class="history-time">'+when+'</span></div></div>';
    }).join('');
    list.querySelectorAll('[data-del]').forEach(b=>{b.addEventListener('click',ev=>{ev.stopPropagation(); deleteHistory(Number(b.getAttribute('data-del')));});});
}

let trendsFilterDays=1;
let trendsPending=false;
function getTrendData(){const h=getHistory(); const now=Date.now(); return h.filter(e=>{if(trendsFilterDays===0) return true; const age=(now-new Date(e.timestamp).getTime())/(1000*60*60*24); return age<=trendsFilterDays;}).map(e=>({ts:new Date(e.timestamp).getTime(),dl:e.download})).sort((a,b)=>a.ts-b.ts);}
function renderTrends(){if(trendsPending) return; trendsPending=true; requestAnimationFrame(()=>{trendsPending=false; _renderTrends();});}
function _renderTrends(){
    const c=$('trendChart'); if(!c) return;
    const wrap=c.parentElement; const rect=wrap.getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio||1, device.isLowEnd?1:2);
    const w=Math.max(rect.width,1),h=Math.max(rect.height,1);
    if(c.width!==w*dpr||c.height!==h*dpr){c.width=w*dpr; c.height=h*dpr;}
    const ctx=c.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
    const data=getTrendData();
    const isMbps = state.speedUnit === 'Mbps';
    const multiplier = isMbps ? 8 : 1;
    if(data.length){const avg=data.reduce((s,x)=>s+x.dl,0)/data.length; const best=Math.max(...data.map(x=>x.dl)); if($('trendAvgVal')) $('trendAvgVal').textContent=avg>=1?(avg*multiplier).toFixed(2):((avg*multiplier)*1024).toFixed(0)+'K'; if($('trendBestVal')) $('trendBestVal').textContent=best>=1?(best*multiplier).toFixed(2):((best*multiplier)*1024).toFixed(0)+'K'; if($('trendCountVal')) $('trendCountVal').textContent=data.length;}
    else {if($('trendAvgVal')) $('trendAvgVal').textContent='-'; if($('trendBestVal')) $('trendBestVal').textContent='-'; if($('trendCountVal')) $('trendCountVal').textContent='0';}
    if(data.length<1){$('trendEmpty').style.display='grid'; return;}
    $('trendEmpty').style.display='none';
    const isDark=document.documentElement.getAttribute('data-theme')!=='light' && document.documentElement.getAttribute('data-theme')!=='pastel';
    const padL=8,padR=42,padT=14,padB=22;
    const plotW=w-padL-padR,plotH=h-padT-padB;
    const textDim=isDark?'rgba(156,163,175,0.9)':'rgba(107,114,128,1)';
    const gridLine=isDark?'rgba(29,78,216,0.07)':'rgba(29,78,216,0.05)';
    const gridStrong=isDark?'rgba(29,78,216,0.16)':'rgba(29,78,216,0.10)';
    const strokeC1='#1D4ED8'; const strokeC2='#1D4ED8';
    let peak=0; for(const d of data) if(d.dl>peak) peak=d.dl;
    const max=Math.max(peak*1.15,0.05) * multiplier;
    const rows=3;
    ctx.font='500 9px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign='right'; ctx.textBaseline='middle';
    for(let i=0;i<=rows;i++){const y=padT+plotH*(i/rows); ctx.strokeStyle=i===rows?gridStrong:gridLine; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+plotW,y); ctx.stroke(); const val=max*(1-i/rows); ctx.fillStyle=textDim; const lbl=val>=1?val.toFixed(val>=10?0:1):(val*1024).toFixed(0); ctx.fillText(lbl,w-4,y);}
    ctx.textAlign='center'; ctx.textBaseline='top';
    const marks=Math.min(data.length,4);
    for(let i=0;i<marks;i++){const idx=Math.floor(i*(data.length-1)/(marks-1||1)); const x=padL+(data.length>1?(idx/(data.length-1))*plotW:plotW/2); const dt=new Date(data[idx].ts); const lbl=dt.toLocaleDateString(state.currentLang==='ar'?'ar':'en',{month:'short',day:'numeric'}); ctx.fillStyle=textDim; ctx.fillText(lbl,x,padT+plotH+4);}
    const pts=data.map((d,i)=>({x:data.length>1?padL+(i/(data.length-1))*plotW:padL+plotW/2, y:padT+plotH-Math.min(((d.dl*multiplier)/max)*plotH,plotH)}));
    const grad=ctx.createLinearGradient(0,padT,0,padT+plotH);
    if(isDark){grad.addColorStop(0,'rgba(29,78,216,0.42)'); grad.addColorStop(0.55,'rgba(29,78,216,0.10)'); grad.addColorStop(1,'rgba(29,78,216,0)');}
    else {grad.addColorStop(0,'rgba(29,78,216,0.28)'); grad.addColorStop(0.55,'rgba(29,78,216,0.06)'); grad.addColorStop(1,'rgba(29,78,216,0)');}
    if(data.length>1){
        ctx.beginPath(); ctx.moveTo(pts[0].x,padT+plotH); ctx.lineTo(pts[0].x,pts[0].y);
        for(let i=1;i<pts.length;i++){const p=pts[i-1],cc=pts[i]; const cx=(p.x+cc.x)/2; ctx.bezierCurveTo(cx,p.y,cx,cc.y,cc.x,cc.y);}
        ctx.lineTo(pts[pts.length-1].x,padT+plotH); ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
        ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
        for(let i=1;i<pts.length;i++){const p=pts[i-1],cc=pts[i]; const cx=(p.x+cc.x)/2; ctx.bezierCurveTo(cx,p.y,cx,cc.y,cc.x,cc.y);}
        const lineGrad=ctx.createLinearGradient(padL,0,padL+plotW,0); lineGrad.addColorStop(0,strokeC2); lineGrad.addColorStop(1,strokeC1);
        ctx.strokeStyle=lineGrad; ctx.lineWidth=2.4; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke();
    }
    pts.forEach((p,i)=>{const isLast=i===pts.length-1; ctx.beginPath(); ctx.arc(p.x,p.y,isLast?5:3.5,0,Math.PI*2); ctx.fillStyle=isDark?'rgba(29,78,216,0.22)':'rgba(29,78,216,0.18)'; ctx.fill(); ctx.beginPath(); ctx.arc(p.x,p.y,isLast?2.6:1.8,0,Math.PI*2); ctx.fillStyle=isLast?'#fff':strokeC1; ctx.fill();});
}

// ===================== THEME & LANG =====================
function loadThemes(){
    const themes = [
        { id: "neon-dark", name: "( Neon Dark )", colors: ["#05080f", "#1D4ED8", "#F9FAFB"] },
        { id: "light", name: " (Light)", colors: ["#F3F4F6", "#1D4ED8", "#111827"] },
        { id: "emerald", name: " (Emerald)", colors: ["#02140E", "#10B981", "#ECFDF5"] },
        { id: "charcoal", name: " (Charcoal)", colors: ["#0F1115", "#3B82F6", "#F9FAFB"] },
        { id: "pastel", name: " (Pastel)", colors: ["#FAFAFA", "#8B5CF6", "#1F2937"] }
    ];

    const grid=$('themeGrid'); if(!grid) return;
    grid.innerHTML=themes.map(t=>`
        <div class="theme-card ${t.id===state.currentTheme?'active':''}" data-theme-id="${t.id}">
            <div class="theme-swatch">
                <span style="background:${t.colors[0]}"></span>
                <span style="background:${t.colors[1]}"></span>
                <span style="background:${t.colors[2]}"></span>
            </div>
            <div class="theme-name">${t.name}</div>
        </div>
    `).join('');
    grid.querySelectorAll('.theme-card').forEach(card=>{
        card.addEventListener('click',()=>{
            const id=card.getAttribute('data-theme-id');
            state.currentTheme=id;
            setStored(CONFIG.THEME_KEY, id);
            document.documentElement.setAttribute('data-theme', id);
            grid.querySelectorAll('.theme-card').forEach(c=>c.classList.remove('active'));
            card.classList.add('active');
            setTimeout(()=>{drawGraph(); renderTrends();}, 100);
        });
    });
}

function applyLang(){
    document.documentElement.lang=state.currentLang;
    document.documentElement.dir=state.currentLang==='ar'?'rtl':'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.getAttribute('data-i18n'));});
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{el.setAttribute('placeholder',t(el.getAttribute('data-i18n-placeholder')));});
    document.querySelectorAll('[data-i18n-aria]').forEach(el=>{el.setAttribute('aria-label',t(el.getAttribute('data-i18n-aria')));});
    document.title=t('pageTitle');
    if(!state.isRunning && !state.results.timestamp) setStatus(t('ready'),'');
    if(state.results.download>0){
        calcScores(state.results.download,state.results.ping,state.results.jitter,state.results.bufferbloat);
        updateScoreUI(state.results.score,state.results.download,state.results.ping,state.results.jitter,state.results.bufferbloat);
        if(state.results.ping>0 && $('ping')) $('ping').textContent=state.results.ping+' ms';
        if(state.results.jitter>0 && $('jitter')) $('jitter').textContent=state.results.jitter+' ms';
        if(state.results.download>0 && $('down')) $('down').textContent=formatSpeed(state.results.download);
        if(state.results.upload>0 && $('up')) $('up').textContent=formatSpeed(state.results.upload);
        if(state.results.timestamp){
            const grade=gradeFromScore(state.results.score);
            if($('idCardBadge')) $('idCardBadge').textContent=grade;
            if($('idCardGrade')) $('idCardGrade').textContent=grade;
            if($('idCardSpeed')) $('idCardSpeed').textContent=formatSpeed(state.results.download);
        }
    }
    updateNetworkInfo();
    renderHistory();
    renderTrends();
    if(state.deviceLoaded) renderDeviceInfo();
    if(state.isRunning) {
        setStatus(t(state.results.timestamp ? 'done' : (state.results.download>0 ? 'uping' : 'downing')), 'running');
    }
}

function openSheet(id){document.body.style.overflow='hidden'; document.querySelectorAll('.sheet').forEach(s=>s.classList.remove('active')); const el=$(id+'Sheet'); if(el) el.classList.add('active'); const fab=$('fab'); if(fab) fab.classList.remove('visible');}
function closeSheet(id){document.body.style.overflow=''; const el=$(id+'Sheet'); if(el) el.classList.remove('active'); updateFabVisibility();}
function updateFabVisibility(){const fab=$('fab'); if(!fab) return; if(document.querySelector('.sheet.active')){fab.classList.remove('visible'); return;} const startBtn=$('btnStart'); if(!startBtn) return; const rect=startBtn.getBoundingClientRect(); const isVisible=rect.bottom>0 && rect.top<window.innerHeight; if(isVisible) fab.classList.remove('visible'); else fab.classList.add('visible');}
function setupPWA(){const manifest={name:'Techovia Speed Test',short_name:'Techovia',description:'Advanced Internet Speed Testing Tool',start_url:'./',scope:'./',display:'standalone',orientation:'portrait',background_color:'#05080f',theme_color:'#1D4ED8',icons:[{src:'./assets/logo.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]}; const blob=new Blob([JSON.stringify(manifest)],{type:'application/manifest+json'}); const link=$('manifestLink'); if(link) link.setAttribute('href',URL.createObjectURL(blob));}

function init(){
    const savedLang=getStored(CONFIG.LANG_KEY);
    if(savedLang && T[savedLang]) state.currentLang=savedLang;
    else state.currentLang=(navigator.language||'ar').startsWith('ar')?'ar':'en';
    const savedTheme=getStored(CONFIG.THEME_KEY);
    if(savedTheme) state.currentTheme=savedTheme;
    else state.currentTheme='neon-dark';
    document.documentElement.setAttribute('data-theme', state.currentTheme);
    applyLang();
    loadThemes();
    initConsent();
    setupConsentEvents();
    
    if($('langSelect')) $('langSelect').value=state.currentLang;
    if($('sizeInput')) $('sizeInput').addEventListener('input',()=>{if(state.lastFinalSpeed>0) updateCalculators(state.lastFinalSpeed);});
    if($('sizeUnit')) $('sizeUnit').addEventListener('change',()=>{if(state.lastFinalSpeed>0) updateCalculators(state.lastFinalSpeed);});
    if($('btnStart')) $('btnStart').addEventListener('click',startTest);
    if($('fab')) $('fab').addEventListener('click',()=>{if(!state.isRunning) startTest();});
    if($('powerBtn')) $('powerBtn').addEventListener('click',()=>{if(state.isRunning) stopTest();});
    if($('themeBtn')) $('themeBtn').addEventListener('click',()=>openSheet('theme'));
    if($('unitSelect')) {
        $('unitSelect').value = state.speedUnit;
        $('unitSelect').addEventListener('change', (e) => {
            state.speedUnit = e.target.value;
            setStored(CONFIG.UNIT_KEY, state.speedUnit);
            if (state.lastFinalSpeed > 0) {
                setSpeed(state.lastFinalSpeed);
                if($('down')) $('down').textContent = formatSpeed(state.lastFinalSpeed);
            }
            if(state.results.upload > 0 && $('up')) $('up').textContent = formatSpeed(state.results.upload);
            if($('idCardSpeed') && state.results.download > 0) $('idCardSpeed').textContent = formatSpeed(state.results.download);
            drawGraph(); renderTrends(); renderHistory();
        });
    }

    document.querySelectorAll('.segmented button').forEach(b=>{
        b.addEventListener('click',()=>{
            document.querySelectorAll('.segmented button').forEach(x=>x.classList.remove('active'));
            b.classList.add('active'); const tab=b.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(tc=>{tc.classList.toggle('active', tc.getAttribute('data-tab')===tab);});
            if(tab==='overview') setTimeout(drawGraph,30);
            if(tab==='trends') setTimeout(renderTrends,30);
            if(tab==='device' && !state.deviceLoaded && state.dataFetched){collectDeviceInfo();}
        });
    });
    
    if($('langSelect')) $('langSelect').addEventListener('change',(e)=>{state.currentLang=T[e.target.value]?e.target.value:'en'; setStored(CONFIG.LANG_KEY, state.currentLang); applyLang();});
    if($('settingsBtn')) $('settingsBtn').addEventListener('click',()=>openSheet('settings'));
    document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeSheet(b.getAttribute('data-close'))));
    document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openSheet(b.getAttribute('data-open'))));
    document.querySelectorAll('.sheet').forEach(s=>{s.addEventListener('click',e=>{if(e.target===s) closeSheet(s.getAttribute('data-sheet'));});});
    document.querySelectorAll('.duration-options button').forEach(b=>{b.addEventListener('click',()=>{document.querySelectorAll('.duration-options button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); state.duration=Number(b.getAttribute('data-duration'));});});
    document.querySelectorAll('.trend-filter button').forEach(b=>{b.addEventListener('click',()=>{document.querySelectorAll('.trend-filter button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); trendsFilterDays=Number(b.getAttribute('data-days')); renderTrends();});});
    
    if($('shareBtn')) $('shareBtn').addEventListener('click',shareText);
    if($('shareImageBtn')) $('shareImageBtn').addEventListener('click',shareImage);
    if($('copyBtn')) $('copyBtn').addEventListener('click',copyReport);
    if($('exportBtn')) $('exportBtn').addEventListener('click',exportJSON);
    if($('clearHistory')) $('clearHistory').addEventListener('click',clearHistory);
    if($('copyUA')) $('copyUA').addEventListener('click',()=>{if(!state.deviceInfo.ua) return; navigator.clipboard.writeText(state.deviceInfo.ua).then(()=>toast(t('uaCopyDone'),'success')).catch(()=>toast(t('copyFailed'),'error'));});
    document.querySelectorAll('[data-copy]').forEach(b=>{b.addEventListener('click',()=>{navigator.clipboard.writeText(b.getAttribute('data-copy')).then(()=>toast(t('copied'),'success')).catch(()=>toast(t('copyFailed'),'error'));});});
    
    const c=$('graph');
    if(c){
        c.addEventListener('mousemove',handleGraphHover);
        c.addEventListener('mouseleave',hideGraphTip);
        c.addEventListener('touchstart',handleGraphHover,{passive:true});
        c.addEventListener('touchmove',handleGraphHover,{passive:true});
        c.addEventListener('touchend',hideGraphTip);
    }
    
    if('ResizeObserver' in window){new ResizeObserver(()=>{drawGraph(); renderTrends();}).observe(document.querySelector('.app'));}
    window.addEventListener('resize',()=>{drawGraph(); renderTrends();});
    document.addEventListener('keydown',(e)=>{if(e.key==='Escape'){document.querySelectorAll('.sheet.active').forEach(s=>s.classList.remove('active')); document.body.style.overflow=''; updateFabVisibility();} if(e.code==='Space' && !state.isRunning && document.activeElement.tagName!=='INPUT' && state.consentGiven){e.preventDefault(); startTest();}});
    window.addEventListener('scroll',updateFabVisibility,{passive:true}); window.addEventListener('resize',updateFabVisibility);
    
    updateNetworkInfo(); renderHistory(); renderTrends();
    window.TechoviaAPI={get results(){return state.results;},get history(){return getHistory();},get device(){return device;},get netInfo(){return state.netInfo;},start: startTest,stop: stopTest};
    requestAnimationFrame(()=>{drawGraph(); renderTrends(); updateFabVisibility(); setTimeout(()=>{drawGraph(); renderTrends(); updateFabVisibility();},100);});
    setupPWA();
    console.log('%c⚡ TECHOVIA Speed Test v11.0','color:#1D4ED8;font-size:16px;font-weight:bold;');
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded', init);} else {init();}
})();
