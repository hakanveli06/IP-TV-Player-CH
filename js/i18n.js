/* i18n.js - H&M Player arayuz dili ve icerik bolgesi */
'use strict';

var I18n = {
  languages: [
    { code: 'auto', name: 'Automatic / Otomatik' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
    { code: 'ru', name: 'Русский' },
    { code: 'pt', name: 'Português' }
  ],
  regions: [
    { code: 'auto', key: 'region.auto' }, { code: 'TR', key: 'region.TR' },
    { code: 'DE', key: 'region.DE' }, { code: 'FR', key: 'region.FR' },
    { code: 'GB', key: 'region.GB' }, { code: 'US', key: 'region.US' },
    { code: 'ES', key: 'region.ES' }, { code: 'IT', key: 'region.IT' },
    { code: 'NL', key: 'region.NL' }, { code: 'BE', key: 'region.BE' },
    { code: 'AT', key: 'region.AT' }, { code: 'CH', key: 'region.CH' },
    { code: 'PT', key: 'region.PT' }, { code: 'BR', key: 'region.BR' },
    { code: 'CA', key: 'region.CA' }, { code: 'AU', key: 'region.AU' }
  ],
  base: {
    'language.title': 'Language', 'language.help': 'Choose the language used by the application interface.',
    'language.autoHint': 'Automatic uses the language reported by the TV.',
    'language.change': 'Application language', 'language.saved': 'Language saved',
    'common.auto': 'Automatic', 'common.back': 'Back', 'common.close': 'Close',
    'common.saveTest': 'Save and test', 'common.show': 'Show', 'common.hide': 'Hide',
    'common.select': 'Select', 'common.change': 'Change', 'common.recommended': 'Recommended',
    'common.on': 'On', 'common.off': 'Off', 'common.notAvailable': 'Not available',
    'rail.home': 'Home', 'rail.live': 'Live TV', 'rail.movies': 'Movies', 'rail.series': 'Series',
    'rail.favs': 'Favourites', 'rail.recent': 'Recently watched', 'rail.settings': 'Settings',
    'rail.about': 'About', 'rail.account': 'Choose account',
    'live.search': 'Search all live channels (at least 3 letters)', 'live.categories': 'Categories',
    'live.channels': 'Channels', 'live.epg': 'Programme guide', 'live.select': 'Select a channel',
    'live.noCategory': 'No categories', 'live.noChannel': 'No channels in this category',
    'library.movieSearch': 'Search all movies (at least 3 letters)',
    'library.seriesSearch': 'Search all series (at least 3 letters)',
    'library.noContent': 'No content in this category',
    'favs.added': 'Added to favourites', 'favs.removed': 'Removed from favourites',
    'favs.empty': 'No favourites yet.\nUse the yellow button in lists to add one.',
    'recent.clear': 'Clear all', 'recent.newest': 'Most recently watched',
    'recent.removeHint': 'Yellow button: remove', 'recent.content': 'Content',
    'recent.empty': 'No movies or series watched yet.',
    'detail.rating': 'Rating', 'detail.resume': 'Resume', 'detail.restart': 'Play from beginning',
    'detail.play': 'Play', 'detail.ratings': 'Ratings and details',
    'detail.addFav': 'Add to favourites', 'detail.removeFav': 'Remove from favourites',
    'detail.season': 'Season', 'detail.episodes': 'Episodes',
    'about.title': 'About', 'about.credit': 'Developed by Hakan Veli.', 'about.menu': 'Return to menu',
    'login.addTitle': 'Add IPTV account', 'login.editTitle': 'Update IPTV account',
    'login.addHint': 'Enter your Xtream account details. Profile name is optional.',
    'login.editHint': 'Update the profile. Leave the password empty to keep the current password.',
    'login.profile': 'Profile name (optional)', 'login.profilePlaceholder': 'Example: Home account',
    'login.server': 'Server address', 'login.serverPlaceholder': 'Panel address or full M3U link',
    'login.username': 'Username', 'login.password': 'Password',
    'login.keepPassword': 'Leave empty to keep the current password',
    'login.showPassword': 'Show password', 'login.hidePassword': 'Hide password',
    'login.add': 'Verify and add account', 'login.update': 'Verify and save',
    'login.required': 'Server, username and password are required.', 'login.failed': 'Sign-in failed.',
    'settings.title': 'Settings', 'settings.what': 'What does this setting do?',
    'settings.selectHelp': 'Press OK to select or change this option.',
    'settings.footer': 'OK: Select / Change   ·   Back: Main menu',
    'settings.languageTitle': 'Application language',
    'settings.languageHelp': 'Changes menus, messages and help text. Provider channel and category names remain unchanged.',
    'settings.tmdbTitle': 'TMDb movie and series information',
    'settings.tmdbHelp': 'Adds ratings, localised titles and summaries, cast, production details and streaming availability.',
    'tmdb.title': 'TMDb connection', 'tmdb.status': 'TMDb',
    'tmdb.credential': 'TMDb API key or API Read Access Token',
    'tmdb.placeholder': '32-character API key or eyJ... token',
    'tmdb.showKey': 'Show key', 'tmdb.hideKey': 'Hide key', 'tmdb.clear': 'Clear personal key',
    'tmdb.backSettings': 'Return to settings', 'tmdb.how': 'How to enable it',
    'tmdb.why': 'What does TMDb add?',
    'tmdb.benefits': 'Ratings and vote counts · Localised title and short summary · Genre, runtime and age rating · Director/creator · Six lead cast photos · Production company and country · Movie budget and box office · Streaming services available in your selected country',
    'tmdb.optional': 'TMDb is optional and does not affect playback. Requests are independent from your IPTV provider and do not use an IPTV connection.',
    'tmdb.steps': 'Create or sign in to a TMDb account, open Account Settings → API, accept the terms and create an API key. The 32-character API Key is easier to enter on a TV; the long read token is also supported.',
    'tmdb.private': 'The key is stored only on this TV and is never sent to your IPTV provider.',
    'tmdb.family': 'Family edition', 'tmdb.familyReady': 'The embedded key is ready. A personal key entered here takes priority.',
    'tmdb.public': 'Public edition', 'tmdb.publicInfo': 'The shared TMDb service is not configured yet. You may enter your own free key; playback works without TMDb.',
    'tmdb.publicReady': 'The shared TMDb service is ready. A personal key is optional and takes priority.',
    'tmdb.enterFirst': 'Enter a TMDb key or read token first.',
    'tmdb.testing': 'Testing connection…', 'tmdb.success': 'Personal key active · connection successful',
    'tmdb.saved': 'TMDb key verified and saved', 'tmdb.failed': 'TMDb connection could not be verified.',
    'tmdb.cleared': 'Personal TMDb key removed', 'tmdb.familyFallback': 'Personal key removed; embedded Family key is active',
    'tmdb.region': 'Content region', 'tmdb.regionTitle': 'Select your content region',
    'tmdb.regionHelp': 'Choose the country where you live. Netflix, Prime Video, Disney+ and other availability is shown for this country.',
    'tmdb.regionAutoHint': 'Automatic uses the country reported by the TV. You can change it later in Settings → TMDb.',
    'tmdb.regionSaved': 'Content region saved',
    'tmdb.enable': 'Enable TMDb', 'tmdb.notNow': 'Not now',
    'tmdb.unconfigured': 'Not configured', 'tmdb.personalActive': 'Personal key active',
    'tmdb.familyActive': 'Family key active', 'tmdb.proxyActive': 'Public TMDb service active',
    'tmdb.proxyFallback': 'Personal key removed; Public TMDb service is active',
    'tmdb.details': 'Ratings and details', 'tmdb.loading': 'Loading TMDb information…',
    'tmdb.noMatch': 'No reliable TMDb match was found for this title.',
    'tmdb.choose': 'Choose the correct title', 'tmdb.multiple': 'More than one strong match was found.',
    'tmdb.noSummary': 'No short summary is available.', 'tmdb.summaryTmdb': 'Summary · TMDb',
    'tmdb.summaryEnglish': 'English summary · TMDb', 'tmdb.summaryProvider': 'Summary · IPTV provider',
    'tmdb.providerScore': 'Provider rating', 'tmdb.votes': 'votes',
    'tmdb.yearUnknown': 'Year unknown', 'tmdb.minutes': 'min', 'tmdb.seasons': 'seasons',
    'tmdb.age': 'Age', 'tmdb.creator': 'Creator',
    'tmdb.closeFooter': 'OK / Back: Close',
    'tmdb.candidateFooter': 'Up/Down: Select · OK: Open · Back: Cancel',
    'tmdb.director': 'Director/Creator:', 'tmdb.company': 'Production company:', 'tmdb.country': 'Country:',
    'tmdb.budget': 'Budget:', 'tmdb.revenue': 'Box office:', 'tmdb.cast': 'Lead cast',
    'tmdb.availableIn': 'Available in {region}', 'tmdb.none': 'No streaming platform listing was found for this region.',
    'tmdb.unknown': 'Platform availability has not been supplied for this region.',
    'tmdb.justwatch': 'Streaming availability is provided by JustWatch.',
    'tmdb.flatrate': 'Subscription', 'tmdb.free': 'Free', 'tmdb.ads': 'With ads',
    'tmdb.rent': 'Rent', 'tmdb.buy': 'Buy',
    'tmdb.footer': 'Up/Down: Scroll · OK / Back: Close · Data source: TMDb',
    'region.auto': 'Automatic (TV region)', 'region.TR': 'Türkiye', 'region.DE': 'Germany',
    'region.FR': 'France', 'region.GB': 'United Kingdom', 'region.US': 'United States',
    'region.ES': 'Spain', 'region.IT': 'Italy', 'region.NL': 'Netherlands', 'region.BE': 'Belgium',
    'region.AT': 'Austria', 'region.CH': 'Switzerland', 'region.PT': 'Portugal',
    'region.BR': 'Brazil', 'region.CA': 'Canada', 'region.AU': 'Australia'
  },
  dictionaries: {
    tr: {
      'language.title': 'Dil', 'language.help': 'Uygulama arayüzünde kullanılacak dili seçin.',
      'language.autoHint': 'Otomatik seçeneği televizyonun bildirdiği dili kullanır.',
      'language.change': 'Uygulama dili', 'language.saved': 'Dil kaydedildi',
      'common.auto': 'Otomatik', 'common.back': 'Geri', 'common.close': 'Kapat',
      'common.saveTest': 'Kaydet ve test et', 'common.show': 'Göster', 'common.hide': 'Gizle',
      'common.select': 'Seç', 'common.change': 'Değiştir', 'common.recommended': 'Önerilen',
      'common.on': 'Açık', 'common.off': 'Kapalı', 'common.notAvailable': 'Bilgi bulunamadı',
      'rail.home': 'Ana Sayfa', 'rail.live': 'Canlı TV', 'rail.movies': 'Filmler', 'rail.series': 'Diziler',
      'rail.favs': 'Favoriler', 'rail.recent': 'Son İzlediklerim', 'rail.settings': 'Ayarlar',
      'rail.about': 'Hakkında', 'rail.account': 'Hesap seçin',
      'live.search': 'Tüm canlı kanallarda ara (en az 3 harf)', 'live.categories': 'Kategoriler',
      'live.channels': 'Kanallar', 'live.epg': 'Yayın akışı', 'live.select': 'Kanal seçin',
      'live.noCategory': 'Kategori yok', 'live.noChannel': 'Bu kategoride kanal yok',
      'library.movieSearch': 'Tüm filmlerde ara (en az 3 harf)',
      'library.seriesSearch': 'Tüm dizilerde ara (en az 3 harf)',
      'library.noContent': 'Bu kategoride içerik yok',
      'favs.added': 'Favorilere eklendi', 'favs.removed': 'Favorilerden çıkarıldı',
      'favs.empty': 'Henüz favori yok.\nListelerde sarı tuşla favori ekleyebilirsiniz.',
      'recent.clear': 'Tümünü temizle', 'recent.newest': 'En yeni izlenenler',
      'recent.removeHint': 'Sarı tuş: kaldır', 'recent.content': 'İçerik',
      'recent.empty': 'Henüz izlenen film veya dizi yok.',
      'detail.rating': 'Puan', 'detail.resume': 'Devam et', 'detail.restart': 'Baştan oynat',
      'detail.play': 'Oynat', 'detail.ratings': 'Puanlar ve ayrıntılar',
      'detail.addFav': 'Favorilere ekle', 'detail.removeFav': 'Favoriden çıkar',
      'detail.season': 'Sezon', 'detail.episodes': 'Bölümler',
      'about.title': 'Hakkında', 'about.credit': 'Hakan Veli tarafından geliştirilmiştir.', 'about.menu': 'Menüye dön',
      'login.addTitle': 'IPTV hesabı ekle', 'login.editTitle': 'IPTV hesabını güncelle',
      'login.addHint': 'Xtream hesap bilgilerinizi girin. Profil adı isteğe bağlıdır.',
      'login.editHint': 'Profili güncelleyin. Mevcut şifreyi korumak için şifre alanını boş bırakın.',
      'login.profile': 'Profil adı (isteğe bağlı)', 'login.profilePlaceholder': 'Örnek: Ev hesabı',
      'login.server': 'Sunucu adresi', 'login.serverPlaceholder': 'Panel adresi veya tam M3U bağlantısı',
      'login.username': 'Kullanıcı adı', 'login.password': 'Şifre',
      'login.keepPassword': 'Mevcut şifreyi korumak için boş bırakın',
      'login.showPassword': 'Şifreyi göster', 'login.hidePassword': 'Şifreyi gizle',
      'login.add': 'Hesabı doğrula ve ekle', 'login.update': 'Doğrula ve kaydet',
      'login.required': 'Sunucu, kullanıcı adı ve şifre doldurulmalıdır.', 'login.failed': 'Giriş başarısız.',
      'settings.title': 'Ayarlar', 'settings.what': 'Bu ayar ne işe yarar?',
      'settings.selectHelp': 'Seçeneği değiştirmek veya açmak için OK tuşuna basın.',
      'settings.footer': 'OK: Seç / Değiştir   ·   Geri: Ana menü',
      'settings.languageTitle': 'Uygulama dili',
      'settings.languageHelp': 'Menüleri, mesajları ve yardım metinlerini değiştirir. Sağlayıcının kanal ve kategori adları olduğu gibi kalır.',
      'settings.tmdbTitle': 'TMDb film ve dizi bilgileri',
      'settings.tmdbHelp': 'Puan, yerelleştirilmiş başlık ve özet, oyuncular, yapım bilgileri ve platform erişimi ekler.',
      'tmdb.title': 'TMDb bağlantısı', 'tmdb.status': 'TMDb',
      'tmdb.credential': 'TMDb API anahtarı veya API okuma erişim jetonu',
      'tmdb.placeholder': '32 karakterli API anahtarı veya eyJ... jetonu',
      'tmdb.showKey': 'Anahtarı göster', 'tmdb.hideKey': 'Anahtarı gizle',
      'tmdb.clear': 'Kişisel anahtarı temizle', 'tmdb.backSettings': 'Ayarlara dön',
      'tmdb.how': 'Nasıl etkinleştirilir?', 'tmdb.why': 'TMDb ne kazandırır?',
      'tmdb.benefits': 'Puan ve oy sayısı · Türkçe başlık ve kısa özet · Tür, süre ve yaş sınırı · Yönetmen/yapımcı · Altı başrol oyuncusunun fotoğrafı · Yapım şirketi ve ülke · Film bütçesi ve gişe · Seçtiğiniz ülkedeki izleme platformları',
      'tmdb.optional': 'TMDb isteğe bağlıdır ve oynatmayı etkilemez. Sorgular IPTV sağlayıcısından bağımsızdır ve IPTV bağlantı hakkını kullanmaz.',
      'tmdb.steps': 'TMDb hesabı oluşturun veya giriş yapın; Hesap Ayarları → API sayfasını açın, koşulları kabul edip API anahtarı oluşturun. Televizyonda yazması daha kolay olan 32 karakterli API Anahtarı önerilir; uzun okuma jetonu da desteklenir.',
      'tmdb.private': 'Anahtar yalnızca bu televizyonda saklanır ve IPTV sağlayıcınıza gönderilmez.',
      'tmdb.family': 'Family sürümü', 'tmdb.familyReady': 'Gömülü anahtar hazırdır. Buraya girilen kişisel anahtar öncelikli olur.',
      'tmdb.public': 'Public sürümü', 'tmdb.publicInfo': 'Ortak TMDb hizmeti henüz yapılandırılmadı. İsterseniz kendi ücretsiz anahtarınızı girebilirsiniz; oynatma TMDb olmadan da çalışır.',
      'tmdb.publicReady': 'Ortak TMDb hizmeti hazırdır. Kişisel anahtar isteğe bağlıdır ve girilirse öncelikli kullanılır.',
      'tmdb.enterFirst': 'Önce bir TMDb anahtarı veya okuma jetonu girin.',
      'tmdb.testing': 'Bağlantı test ediliyor…', 'tmdb.success': 'Kişisel anahtar etkin · bağlantı başarılı',
      'tmdb.saved': 'TMDb anahtarı doğrulandı ve kaydedildi', 'tmdb.failed': 'TMDb bağlantısı doğrulanamadı.',
      'tmdb.cleared': 'Kişisel TMDb anahtarı silindi', 'tmdb.familyFallback': 'Kişisel anahtar silindi; Family anahtarı etkin',
      'tmdb.region': 'İçerik bölgesi', 'tmdb.regionTitle': 'İçerik bölgenizi seçin',
      'tmdb.regionHelp': 'Yaşadığınız ülkeyi seçin. Netflix, Prime Video, Disney+ ve diğer platform bilgileri bu ülkeye göre gösterilir.',
      'tmdb.regionAutoHint': 'Otomatik seçeneği TV’nin bildirdiği ülkeyi kullanır. Daha sonra Ayarlar → TMDb bölümünden değiştirebilirsiniz.',
      'tmdb.regionSaved': 'İçerik bölgesi kaydedildi',
      'tmdb.enable': 'TMDb’yi etkinleştir', 'tmdb.notNow': 'Şimdi değil',
      'tmdb.unconfigured': 'Yapılandırılmamış', 'tmdb.personalActive': 'Kişisel anahtar etkin',
      'tmdb.familyActive': 'Family anahtarı etkin', 'tmdb.proxyActive': 'Public TMDb hizmeti etkin',
      'tmdb.proxyFallback': 'Kişisel anahtar silindi; Public TMDb hizmeti etkin',
      'tmdb.details': 'Puanlar ve ayrıntılar', 'tmdb.loading': 'TMDb bilgileri alınıyor…',
      'tmdb.noMatch': 'Bu yapım için güvenilir bir TMDb eşleşmesi bulunamadı.',
      'tmdb.choose': 'Doğru yapımı seçin', 'tmdb.multiple': 'Birden fazla kuvvetli eşleşme bulundu.',
      'tmdb.noSummary': 'Kısa özet bulunmuyor.', 'tmdb.summaryTmdb': 'Özet · TMDb',
      'tmdb.summaryEnglish': 'İngilizce özet · TMDb', 'tmdb.summaryProvider': 'Özet · IPTV sağlayıcısı',
      'tmdb.providerScore': 'Sağlayıcı puanı', 'tmdb.votes': 'oy',
      'tmdb.yearUnknown': 'Yıl bilinmiyor', 'tmdb.minutes': 'dk', 'tmdb.seasons': 'sezon',
      'tmdb.age': 'Yaş', 'tmdb.creator': 'Yaratıcı',
      'tmdb.closeFooter': 'OK / Geri: Kapat',
      'tmdb.candidateFooter': 'Yukarı/Aşağı: Seçim · OK: Aç · Geri: İptal',
      'tmdb.director': 'Yönetmen/Yapımcı:', 'tmdb.company': 'Yapım şirketi:', 'tmdb.country': 'Ülke:',
      'tmdb.budget': 'Bütçe:', 'tmdb.revenue': 'Gişe:', 'tmdb.cast': 'Başrol oyuncuları',
      'tmdb.availableIn': '{region}\'de nerede izlenir?', 'tmdb.none': 'Platformlarda gösterimi yok.',
      'tmdb.unknown': 'Platformlarda gösterimi yok.',
      'tmdb.justwatch': 'Platform bilgileri JustWatch tarafından sağlanmaktadır.',
      'tmdb.flatrate': 'Abonelik', 'tmdb.free': 'Ücretsiz', 'tmdb.ads': 'Reklamlı',
      'tmdb.rent': 'Kiralama', 'tmdb.buy': 'Satın alma',
      'tmdb.footer': 'Yukarı/Aşağı: Kaydır · OK / Geri: Kapat · Veri kaynağı: TMDb',
      'region.auto': 'Otomatik (TV bölgesi)', 'region.TR': 'Türkiye', 'region.DE': 'Almanya',
      'region.FR': 'Fransa', 'region.GB': 'Birleşik Krallık', 'region.US': 'ABD',
      'region.ES': 'İspanya', 'region.IT': 'İtalya', 'region.NL': 'Hollanda', 'region.BE': 'Belçika',
      'region.AT': 'Avusturya', 'region.CH': 'İsviçre', 'region.PT': 'Portekiz',
      'region.BR': 'Brezilya', 'region.CA': 'Kanada', 'region.AU': 'Avustralya'
    },
    de: { 'language.title': 'Sprache', 'language.help': 'Wählen Sie die Sprache der Benutzeroberfläche.', 'rail.live': 'Live-TV', 'rail.movies': 'Filme', 'rail.series': 'Serien', 'rail.favs': 'Favoriten', 'rail.recent': 'Zuletzt angesehen', 'rail.settings': 'Einstellungen', 'rail.about': 'Über', 'settings.title': 'Einstellungen', 'tmdb.region': 'Inhaltsregion', 'tmdb.regionTitle': 'Inhaltsregion wählen', 'tmdb.availableIn': 'Verfügbar in {region}', 'tmdb.cast': 'Hauptdarsteller', 'tmdb.details': 'Bewertungen und Details' },
    fr: { 'language.title': 'Langue', 'language.help': "Choisissez la langue de l’interface.", 'rail.live': 'TV en direct', 'rail.movies': 'Films', 'rail.series': 'Séries', 'rail.favs': 'Favoris', 'rail.recent': 'Vus récemment', 'rail.settings': 'Paramètres', 'rail.about': 'À propos', 'settings.title': 'Paramètres', 'tmdb.region': 'Région du contenu', 'tmdb.regionTitle': 'Choisir la région', 'tmdb.availableIn': 'Disponible en {region}', 'tmdb.cast': 'Acteurs principaux', 'tmdb.details': 'Notes et détails' },
    es: { 'language.title': 'Idioma', 'language.help': 'Elige el idioma de la interfaz.', 'rail.live': 'TV en directo', 'rail.movies': 'Películas', 'rail.series': 'Series', 'rail.favs': 'Favoritos', 'rail.recent': 'Visto recientemente', 'rail.settings': 'Ajustes', 'rail.about': 'Acerca de', 'settings.title': 'Ajustes', 'tmdb.region': 'Región de contenido', 'tmdb.regionTitle': 'Selecciona la región', 'tmdb.availableIn': 'Disponible en {region}', 'tmdb.cast': 'Reparto principal', 'tmdb.details': 'Puntuaciones y detalles' },
    ru: { 'language.title': 'Язык', 'language.help': 'Выберите язык интерфейса приложения.', 'rail.live': 'Эфирное ТВ', 'rail.movies': 'Фильмы', 'rail.series': 'Сериалы', 'rail.favs': 'Избранное', 'rail.recent': 'Недавно просмотренные', 'rail.settings': 'Настройки', 'rail.about': 'О приложении', 'settings.title': 'Настройки', 'tmdb.region': 'Регион контента', 'tmdb.regionTitle': 'Выберите регион', 'tmdb.availableIn': 'Доступно в регионе {region}', 'tmdb.cast': 'В главных ролях', 'tmdb.details': 'Рейтинги и сведения' },
    pt: { 'language.title': 'Idioma', 'language.help': 'Escolha o idioma da interface.', 'rail.live': 'TV ao vivo', 'rail.movies': 'Filmes', 'rail.series': 'Séries', 'rail.favs': 'Favoritos', 'rail.recent': 'Vistos recentemente', 'rail.settings': 'Definições', 'rail.about': 'Sobre', 'settings.title': 'Definições', 'tmdb.region': 'Região de conteúdo', 'tmdb.regionTitle': 'Selecionar região', 'tmdb.availableIn': 'Disponível em {region}', 'tmdb.cast': 'Elenco principal', 'tmdb.details': 'Avaliações e detalhes' }
  },
  systemLocale: function () {
    var value = '';
    try { value = navigator.language || navigator.userLanguage || ''; } catch (e) { }
    return String(value || 'en-US').replace('_', '-');
  },
  selected: function () {
    var value = 'auto';
    try { if (typeof Settings !== 'undefined') value = Settings.get('uiLanguage') || 'auto'; } catch (e) { }
    if (value !== 'auto') return value;
    var code = this.systemLocale().split('-')[0].toLowerCase();
    return ['tr', 'en', 'de', 'fr', 'es', 'ru', 'pt'].indexOf(code) !== -1 ? code : 'en';
  },
  t: function (key, vars) {
    var lang = this.selected(), value = (this.dictionaries[lang] && this.dictionaries[lang][key]) || this.base[key] || key;
    vars = vars || {};
    return String(value).replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, name) {
      return vars[name] == null ? '' : String(vars[name]);
    });
  },
  languageName: function (code) {
    for (var i = 0; i < this.languages.length; i++) if (this.languages[i].code === code) return this.languages[i].name;
    return code;
  },
  tmdbLocale: function () {
    var map = { tr: 'tr-TR', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', ru: 'ru-RU', pt: 'pt-PT' };
    var lang = this.selected(), region = '';
    try { if (typeof Settings !== 'undefined') region = Settings.get('contentRegion') || ''; } catch (e) { }
    if (lang === 'en' && region === 'GB') return 'en-GB';
    if (lang === 'pt' && region === 'BR') return 'pt-BR';
    if (lang === 'fr' && region === 'CA') return 'fr-CA';
    return map[lang] || 'en-US';
  },
  resolvedRegion: function () {
    var selected = 'auto';
    try { if (typeof Settings !== 'undefined') selected = Settings.get('contentRegion') || 'auto'; } catch (e) { }
    if (selected !== 'auto') return selected;
    var parts = this.systemLocale().split('-'), candidate = parts.length > 1 ? parts[1].toUpperCase() : '';
    var known = this.regions.some(function (r) { return r.code === candidate; });
    return known ? candidate : (this.selected() === 'tr' ? 'TR' : 'US');
  },
  regionName: function (code) { return this.t('region.' + (code || this.resolvedRegion())); },
  localeForDate: function () { return this.tmdbLocale(); },
  apply: function () {
    try { document.documentElement.lang = this.selected(); document.documentElement.dir = 'ltr'; } catch (e) { }
  }
};

function t(key, vars) { return I18n.t(key, vars); }
