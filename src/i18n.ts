// Every piece of interface text goes through t(). The language setting drives both these
// strings and the Pokémon, nature and type names that come from the data files.
// Non-English text is a first pass and should be checked by native speakers.
import type { NameLocale } from './catalog';

const en = {
  'app.tagline': 'Check today’s recruits against your roster.',
  'home': 'RanchRadar, back to your roster',
  'search.label': 'Search Pokémon',
  'search.placeholder': 'Search Pokémon',
  'search.clear': 'Clear search',
  'search.none': 'No legal Pokémon start with “{query}”. Check the spelling, or change the language in Settings.',
  'results.count': '{count} results',
  'results.one': '1 result',
  'results.back': 'Back to your roster',
  'roster.heading': 'Your roster',
  'roster.count': '{count} Pokémon',
  'roster.copies': '{count} owned',
  'roster.empty.title': 'Your ranch is empty',
  'roster.empty.body': 'Search for a Pokémon above and tap + to add it.',
  'roster.view': 'Roster layout',
  'roster.view.grid': 'Grid',
  'roster.view.list': 'List',
  'own.none': 'Not owned',
  'own.summary': '{total} owned ({parts})',
  'own.perm': '{count} perm',
  'own.trial': '{count} trial',
  'own.expired': '{count} expired',
  'add.permanent': 'Add {name} as permanent',
  'add.trial': 'Add {name} as trial',
  'add.details': 'Add {name} with details',
  'add.title': 'Add {name}',
  'add.submit': 'Add to roster',
  'added.permanent': 'Added {name} as permanent',
  'added.trial': 'Added {name} as trial',
  'undo': 'Undo',
  'cancel': 'Cancel',
  'close': 'Close',
  'status.label': 'Status',
  'status.permanent': 'Permanent',
  'status.trial': 'Trial',
  'nature.label': 'Nature',
  'nature.none': 'Not set',
  'nature.neutral': 'Neutral',
  'nature.sort': 'Sort natures',
  'nature.sort.az': 'A–Z',
  'nature.sort.stat': 'By stat',
  'nature.raises': 'Raises {stat}',
  'stat.atk': 'Atk', 'stat.def': 'Def', 'stat.spa': 'SpA', 'stat.spd': 'SpD', 'stat.spe': 'Spe',
  'notes.label': 'Notes',
  'notes.placeholder': 'Moves, item, anything to remember',
  'entry.permanent': 'Permanent',
  'entry.trialExpires': 'Trial until {date}',
  'entry.trialExpired': 'Trial, expired {date}',
  'entry.editCopy': 'Edit {label}',
  'entry.save': 'Save changes',
  'entry.saved': 'Saved changes',
  'entry.delete': 'Remove from roster',
  'entry.deleted': 'Removed {name}',
  'form.entries': 'Your {name}',
  'form.copies': '{count} in your box',
  'form.copyLabel': 'Copy {n} of {total}',
  'form.addAnother': 'Add another',
  'settings.open': 'Settings',
  'settings.title': 'Settings',
  'settings.theme': 'Appearance',
  'settings.theme.system': 'Match device',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.language': 'Language',
  'settings.languageHint': 'Changes the app’s text, Pokémon names and search.',
  'settings.disclaimer': 'RanchRadar is a fan project, not affiliated with Nintendo, Game Freak, Creatures, or The Pokémon Company.',
  'update.available': 'A new version of RanchRadar is ready.',
  'update.reload': 'Refresh',
  'error.generic': 'That didn’t save: {message}',
  'loading': 'Loading your roster…',
  'trial.days': '{count}d left', 'trial.hours': '{count}h left', 'trial.soon': '<1h left', 'trial.expired': 'Expired', 'trial.leftLong': 'Trial ends in {time}',
};

export type MessageKey = keyof typeof en;
type Messages = Partial<Record<MessageKey, string>>;

const ja: Messages = {
  'trial.days': '残り{count}日', 'trial.hours': '残り{count}時間', 'trial.soon': '残り1時間未満', 'trial.expired': '期限切れ', 'trial.leftLong': 'お試し終了まで{time}',
  'app.tagline': '今日のスカウト候補を手持ちと照らし合わせよう。',
  'home': 'RanchRadar、ロースターに戻る',
  'search.label': 'ポケモンを検索', 'search.placeholder': 'ポケモンを検索', 'search.clear': '検索をクリア',
  'search.none': '「{query}」で始まる使用可能なポケモンはいません。つづりを確認するか、設定で言語を変更してください。',
  'results.count': '{count}件', 'results.one': '1件', 'results.back': 'ロースターに戻る',
  'roster.heading': 'あなたのロースター', 'roster.count': '{count}匹', 'roster.copies': '{count}匹所持',
  'roster.empty.title': '牧場はまだ空っぽです', 'roster.empty.body': '上で検索して＋をタップすると追加できます。',
  'roster.view': 'ロースターの表示', 'roster.view.grid': 'グリッド', 'roster.view.list': 'リスト',
  'own.none': '未所持', 'own.summary': '{total}匹（{parts}）', 'own.perm': '正式{count}', 'own.trial': 'お試し{count}', 'own.expired': '期限切れ{count}',
  'add.permanent': '{name}を正式加入で追加', 'add.trial': '{name}をお試しで追加', 'add.details': '{name}を詳細つきで追加',
  'add.title': '{name}を追加', 'add.submit': 'ロースターに追加',
  'added.permanent': '{name}を正式加入で追加しました', 'added.trial': '{name}をお試しで追加しました',
  'undo': '元に戻す', 'cancel': 'キャンセル', 'close': '閉じる',
  'status.label': '状態', 'status.permanent': '正式加入', 'status.trial': 'お試し',
  'nature.label': 'せいかく', 'nature.none': '未設定', 'nature.neutral': '補正なし',
  'nature.sort': 'せいかくの並び順', 'nature.sort.az': '50音順', 'nature.sort.stat': '能力順', 'nature.raises': '{stat}が上がる',
  'stat.atk': '攻撃', 'stat.def': '防御', 'stat.spa': '特攻', 'stat.spd': '特防', 'stat.spe': '素早',
  'notes.label': 'メモ', 'notes.placeholder': 'わざ、もちもの、覚えておきたいこと',
  'entry.permanent': '正式加入', 'entry.trialExpires': '{date}までお試し', 'entry.trialExpired': 'お試し期限切れ（{date}）',
  'entry.editCopy': '{label}を編集', 'entry.save': '変更を保存', 'entry.saved': '変更を保存しました',
  'entry.delete': 'ロースターから外す', 'entry.deleted': '{name}を外しました',
  'form.entries': 'あなたの{name}', 'form.copies': 'ボックスに{count}匹', 'form.copyLabel': '{total}匹中{n}匹目', 'form.addAnother': 'もう1匹追加',
  'settings.open': '設定', 'settings.title': '設定', 'settings.theme': '外観',
  'settings.theme.system': '自動', 'settings.theme.light': 'ライト', 'settings.theme.dark': 'ダーク',
  'settings.language': '言語', 'settings.languageHint': 'アプリの表示、ポケモンの名前、検索が切り替わります。',
  'settings.disclaimer': 'RanchRadarはファンによる非公式プロジェクトで、任天堂、ゲームフリーク、クリーチャーズ、株式会社ポケモンとは関係ありません。',
  'update.available': 'RanchRadarの新しいバージョンがあります。', 'update.reload': '更新',
  'error.generic': '保存できませんでした：{message}', 'loading': 'ロースターを読み込み中…',
};

const ko: Messages = {
  'trial.days': '{count}일 남음', 'trial.hours': '{count}시간 남음', 'trial.soon': '1시간 미만', 'trial.expired': '만료됨', 'trial.leftLong': '체험 종료까지 {time}',
  'app.tagline': '오늘의 영입 후보를 내 로스터와 비교해 보세요.',
  'home': 'RanchRadar, 로스터로 돌아가기',
  'search.label': '포켓몬 검색', 'search.placeholder': '포켓몬 검색', 'search.clear': '검색 지우기',
  'search.none': '“{query}”(으)로 시작하는 사용 가능한 포켓몬이 없습니다. 철자를 확인하거나 설정에서 언어를 바꿔 보세요.',
  'results.count': '{count}개 결과', 'results.one': '1개 결과', 'results.back': '로스터로 돌아가기',
  'roster.heading': '내 로스터', 'roster.count': '포켓몬 {count}마리', 'roster.copies': '{count}마리 보유',
  'roster.empty.title': '목장이 비어 있어요', 'roster.empty.body': '위에서 포켓몬을 검색하고 +를 눌러 추가하세요.',
  'roster.view': '로스터 보기', 'roster.view.grid': '격자', 'roster.view.list': '목록',
  'own.none': '미보유', 'own.summary': '{total}마리 보유 ({parts})', 'own.perm': '정식 {count}', 'own.trial': '체험 {count}', 'own.expired': '만료 {count}',
  'add.permanent': '{name}을(를) 정식으로 추가', 'add.trial': '{name}을(를) 체험으로 추가', 'add.details': '{name}을(를) 상세 정보와 함께 추가',
  'add.title': '{name} 추가', 'add.submit': '로스터에 추가',
  'added.permanent': '{name}을(를) 정식으로 추가했습니다', 'added.trial': '{name}을(를) 체험으로 추가했습니다',
  'undo': '실행 취소', 'cancel': '취소', 'close': '닫기',
  'status.label': '상태', 'status.permanent': '정식', 'status.trial': '체험',
  'nature.label': '성격', 'nature.none': '미설정', 'nature.neutral': '보정 없음',
  'nature.sort': '성격 정렬', 'nature.sort.az': '가나다순', 'nature.sort.stat': '능력치순', 'nature.raises': '{stat} 상승',
  'stat.atk': '공격', 'stat.def': '방어', 'stat.spa': '특공', 'stat.spd': '특방', 'stat.spe': '스피드',
  'notes.label': '메모', 'notes.placeholder': '기술, 도구, 기억할 내용',
  'entry.permanent': '정식', 'entry.trialExpires': '{date}까지 체험', 'entry.trialExpired': '체험 만료 ({date})',
  'entry.editCopy': '{label} 편집', 'entry.save': '변경 사항 저장', 'entry.saved': '변경 사항을 저장했습니다',
  'entry.delete': '로스터에서 제거', 'entry.deleted': '{name}을(를) 제거했습니다',
  'form.entries': '내 {name}', 'form.copies': '박스에 {count}마리', 'form.copyLabel': '{total}마리 중 {n}번째', 'form.addAnother': '한 마리 더 추가',
  'settings.open': '설정', 'settings.title': '설정', 'settings.theme': '화면 모드',
  'settings.theme.system': '자동', 'settings.theme.light': '라이트', 'settings.theme.dark': '다크',
  'settings.language': '언어', 'settings.languageHint': '앱 텍스트, 포켓몬 이름, 검색 언어가 바뀝니다.',
  'settings.disclaimer': 'RanchRadar는 팬 프로젝트이며 Nintendo, Game Freak, Creatures, The Pokémon Company와 관련이 없습니다.',
  'update.available': 'RanchRadar의 새 버전이 준비되었습니다.', 'update.reload': '새로고침',
  'error.generic': '저장하지 못했습니다: {message}', 'loading': '로스터를 불러오는 중…',
};

const zhHant: Messages = {
  'trial.days': '剩 {count} 天', 'trial.hours': '剩 {count} 小時', 'trial.soon': '不到 1 小時', 'trial.expired': '已過期', 'trial.leftLong': '試用結束：{time}',
  'app.tagline': '把今天的招募對象和你的陣容比對一下。',
  'home': 'RanchRadar，回到你的陣容',
  'search.label': '搜尋寶可夢', 'search.placeholder': '搜尋寶可夢', 'search.clear': '清除搜尋',
  'search.none': '沒有以「{query}」開頭的可用寶可夢。請檢查拼寫，或到設定中更改語言。',
  'results.count': '{count} 個結果', 'results.one': '1 個結果', 'results.back': '回到你的陣容',
  'roster.heading': '你的陣容', 'roster.count': '{count} 隻寶可夢', 'roster.copies': '擁有 {count} 隻',
  'roster.empty.title': '牧場還是空的', 'roster.empty.body': '在上方搜尋寶可夢，點 + 加入。',
  'roster.view': '陣容版面', 'roster.view.grid': '格狀', 'roster.view.list': '清單',
  'own.none': '未擁有', 'own.summary': '擁有 {total} 隻（{parts}）', 'own.perm': '正式 {count}', 'own.trial': '試用 {count}', 'own.expired': '已過期 {count}',
  'add.permanent': '將{name}加入為正式', 'add.trial': '將{name}加入為試用', 'add.details': '填寫詳細資料加入{name}',
  'add.title': '加入{name}', 'add.submit': '加入陣容',
  'added.permanent': '已將{name}加入為正式', 'added.trial': '已將{name}加入為試用',
  'undo': '復原', 'cancel': '取消', 'close': '關閉',
  'status.label': '狀態', 'status.permanent': '正式', 'status.trial': '試用',
  'nature.label': '性格', 'nature.none': '未設定', 'nature.neutral': '無修正',
  'nature.sort': '性格排序', 'nature.sort.az': '依名稱', 'nature.sort.stat': '依能力', 'nature.raises': '提升{stat}',
  'stat.atk': '攻擊', 'stat.def': '防禦', 'stat.spa': '特攻', 'stat.spd': '特防', 'stat.spe': '速度',
  'notes.label': '備註', 'notes.placeholder': '招式、道具，任何想記住的事',
  'entry.permanent': '正式', 'entry.trialExpires': '試用至 {date}', 'entry.trialExpired': '試用已過期（{date}）',
  'entry.editCopy': '編輯{label}', 'entry.save': '儲存變更', 'entry.saved': '已儲存變更',
  'entry.delete': '從陣容移除', 'entry.deleted': '已移除{name}',
  'form.entries': '你的{name}', 'form.copies': '盒子裡有 {count} 隻', 'form.copyLabel': '第 {n} 隻，共 {total} 隻', 'form.addAnother': '再加一隻',
  'settings.open': '設定', 'settings.title': '設定', 'settings.theme': '外觀',
  'settings.theme.system': '自動', 'settings.theme.light': '淺色', 'settings.theme.dark': '深色',
  'settings.language': '語言', 'settings.languageHint': '會變更 App 文字、寶可夢名稱和搜尋。',
  'settings.disclaimer': 'RanchRadar 是粉絲專案，與任天堂、Game Freak、Creatures 及寶可夢公司無關。',
  'update.available': 'RanchRadar 有新版本可用。', 'update.reload': '重新整理',
  'error.generic': '無法儲存：{message}', 'loading': '正在載入你的陣容…',
};

const zhHans: Messages = {
  'trial.days': '剩 {count} 天', 'trial.hours': '剩 {count} 小时', 'trial.soon': '不到 1 小时', 'trial.expired': '已过期', 'trial.leftLong': '试用结束：{time}',
  'app.tagline': '把今天的招募对象和你的阵容对比一下。',
  'home': 'RanchRadar，返回你的阵容',
  'search.label': '搜索宝可梦', 'search.placeholder': '搜索宝可梦', 'search.clear': '清除搜索',
  'search.none': '没有以“{query}”开头的可用宝可梦。请检查拼写，或在设置中更改语言。',
  'results.count': '{count} 个结果', 'results.one': '1 个结果', 'results.back': '返回你的阵容',
  'roster.heading': '你的阵容', 'roster.count': '{count} 只宝可梦', 'roster.copies': '拥有 {count} 只',
  'roster.empty.title': '牧场还是空的', 'roster.empty.body': '在上方搜索宝可梦，点 + 添加。',
  'roster.view': '阵容布局', 'roster.view.grid': '网格', 'roster.view.list': '列表',
  'own.none': '未拥有', 'own.summary': '拥有 {total} 只（{parts}）', 'own.perm': '正式 {count}', 'own.trial': '试用 {count}', 'own.expired': '已过期 {count}',
  'add.permanent': '将{name}添加为正式', 'add.trial': '将{name}添加为试用', 'add.details': '填写详情添加{name}',
  'add.title': '添加{name}', 'add.submit': '添加到阵容',
  'added.permanent': '已将{name}添加为正式', 'added.trial': '已将{name}添加为试用',
  'undo': '撤销', 'cancel': '取消', 'close': '关闭',
  'status.label': '状态', 'status.permanent': '正式', 'status.trial': '试用',
  'nature.label': '性格', 'nature.none': '未设置', 'nature.neutral': '无修正',
  'nature.sort': '性格排序', 'nature.sort.az': '按名称', 'nature.sort.stat': '按能力', 'nature.raises': '提升{stat}',
  'stat.atk': '攻击', 'stat.def': '防御', 'stat.spa': '特攻', 'stat.spd': '特防', 'stat.spe': '速度',
  'notes.label': '备注', 'notes.placeholder': '招式、道具，任何想记住的事',
  'entry.permanent': '正式', 'entry.trialExpires': '试用至 {date}', 'entry.trialExpired': '试用已过期（{date}）',
  'entry.editCopy': '编辑{label}', 'entry.save': '保存更改', 'entry.saved': '已保存更改',
  'entry.delete': '从阵容移除', 'entry.deleted': '已移除{name}',
  'form.entries': '你的{name}', 'form.copies': '盒子里有 {count} 只', 'form.copyLabel': '第 {n} 只，共 {total} 只', 'form.addAnother': '再添加一只',
  'settings.open': '设置', 'settings.title': '设置', 'settings.theme': '外观',
  'settings.theme.system': '自动', 'settings.theme.light': '浅色', 'settings.theme.dark': '深色',
  'settings.language': '语言', 'settings.languageHint': '会更改应用文字、宝可梦名称和搜索。',
  'settings.disclaimer': 'RanchRadar 是粉丝项目，与任天堂、Game Freak、Creatures 及宝可梦公司无关。',
  'update.available': 'RanchRadar 有新版本可用。', 'update.reload': '刷新',
  'error.generic': '无法保存：{message}', 'loading': '正在加载你的阵容…',
};

const fr: Messages = {
  'trial.days': '{count} j restants', 'trial.hours': '{count} h restantes', 'trial.soon': '< 1 h', 'trial.expired': 'Expiré', 'trial.leftLong': 'Fin de l’essai : {time}',
  'app.tagline': 'Comparez les recrues du jour à votre équipe.',
  'home': 'RanchRadar, retour à votre équipe',
  'search.label': 'Rechercher un Pokémon', 'search.placeholder': 'Rechercher un Pokémon', 'search.clear': 'Effacer la recherche',
  'search.none': 'Aucun Pokémon autorisé ne commence par « {query} ». Vérifiez l’orthographe ou changez de langue dans les réglages.',
  'results.count': '{count} résultats', 'results.one': '1 résultat', 'results.back': 'Retour à votre équipe',
  'roster.heading': 'Votre équipe', 'roster.count': '{count} Pokémon', 'roster.copies': '{count} possédés',
  'roster.empty.title': 'Votre ranch est vide', 'roster.empty.body': 'Recherchez un Pokémon ci-dessus et touchez + pour l’ajouter.',
  'roster.view': 'Affichage de l’équipe', 'roster.view.grid': 'Grille', 'roster.view.list': 'Liste',
  'own.none': 'Non possédé', 'own.summary': '{total} possédé(s) ({parts})', 'own.perm': '{count} perm.', 'own.trial': '{count} essai', 'own.expired': '{count} expiré(s)',
  'add.permanent': 'Ajouter {name} en permanent', 'add.trial': 'Ajouter {name} à l’essai', 'add.details': 'Ajouter {name} avec des détails',
  'add.title': 'Ajouter {name}', 'add.submit': 'Ajouter à l’équipe',
  'added.permanent': '{name} ajouté en permanent', 'added.trial': '{name} ajouté à l’essai',
  'undo': 'Annuler', 'cancel': 'Annuler', 'close': 'Fermer',
  'status.label': 'Statut', 'status.permanent': 'Permanent', 'status.trial': 'Essai',
  'nature.label': 'Nature', 'nature.none': 'Non définie', 'nature.neutral': 'Neutre',
  'nature.sort': 'Trier les natures', 'nature.sort.az': 'A–Z', 'nature.sort.stat': 'Par stat', 'nature.raises': 'Augmente {stat}',
  'stat.atk': 'Atq', 'stat.def': 'Déf', 'stat.spa': 'Atq Spé', 'stat.spd': 'Déf Spé', 'stat.spe': 'Vit',
  'notes.label': 'Notes', 'notes.placeholder': 'Capacités, objet, tout ce qu’il faut retenir',
  'entry.permanent': 'Permanent', 'entry.trialExpires': 'Essai jusqu’au {date}', 'entry.trialExpired': 'Essai expiré le {date}',
  'entry.editCopy': 'Modifier {label}', 'entry.save': 'Enregistrer', 'entry.saved': 'Modifications enregistrées',
  'entry.delete': 'Retirer de l’équipe', 'entry.deleted': '{name} retiré',
  'form.entries': 'Vos {name}', 'form.copies': '{count} dans votre boîte', 'form.copyLabel': 'Exemplaire {n} sur {total}', 'form.addAnother': 'En ajouter un autre',
  'settings.open': 'Réglages', 'settings.title': 'Réglages', 'settings.theme': 'Apparence',
  'settings.theme.system': 'Comme l’appareil', 'settings.theme.light': 'Clair', 'settings.theme.dark': 'Sombre',
  'settings.language': 'Langue', 'settings.languageHint': 'Change le texte de l’app, les noms des Pokémon et la recherche.',
  'settings.disclaimer': 'RanchRadar est un projet de fan, sans lien avec Nintendo, Game Freak, Creatures ou The Pokémon Company.',
  'update.available': 'Une nouvelle version de RanchRadar est prête.', 'update.reload': 'Actualiser',
  'error.generic': 'Enregistrement impossible : {message}', 'loading': 'Chargement de votre équipe…',
};

const de: Messages = {
  'trial.days': 'noch {count} T.', 'trial.hours': 'noch {count} Std.', 'trial.soon': '< 1 Std.', 'trial.expired': 'Abgelaufen', 'trial.leftLong': 'Probe endet: {time}',
  'app.tagline': 'Vergleiche die heutigen Rekruten mit deinem Team.',
  'home': 'RanchRadar, zurück zu deinem Team',
  'search.label': 'Pokémon suchen', 'search.placeholder': 'Pokémon suchen', 'search.clear': 'Suche löschen',
  'search.none': 'Kein erlaubtes Pokémon beginnt mit „{query}“. Prüfe die Schreibweise oder ändere die Sprache in den Einstellungen.',
  'results.count': '{count} Treffer', 'results.one': '1 Treffer', 'results.back': 'Zurück zu deinem Team',
  'roster.heading': 'Dein Team', 'roster.count': '{count} Pokémon', 'roster.copies': '{count} im Besitz',
  'roster.empty.title': 'Deine Ranch ist leer', 'roster.empty.body': 'Suche oben ein Pokémon und tippe auf +, um es hinzuzufügen.',
  'roster.view': 'Team-Ansicht', 'roster.view.grid': 'Raster', 'roster.view.list': 'Liste',
  'own.none': 'Nicht im Besitz', 'own.summary': '{total} im Besitz ({parts})', 'own.perm': '{count} fest', 'own.trial': '{count} Probe', 'own.expired': '{count} abgelaufen',
  'add.permanent': '{name} fest hinzufügen', 'add.trial': '{name} zur Probe hinzufügen', 'add.details': '{name} mit Details hinzufügen',
  'add.title': '{name} hinzufügen', 'add.submit': 'Zum Team hinzufügen',
  'added.permanent': '{name} fest hinzugefügt', 'added.trial': '{name} zur Probe hinzugefügt',
  'undo': 'Rückgängig', 'cancel': 'Abbrechen', 'close': 'Schließen',
  'status.label': 'Status', 'status.permanent': 'Fest', 'status.trial': 'Probe',
  'nature.label': 'Wesen', 'nature.none': 'Nicht festgelegt', 'nature.neutral': 'Neutral',
  'nature.sort': 'Wesen sortieren', 'nature.sort.az': 'A–Z', 'nature.sort.stat': 'Nach Wert', 'nature.raises': 'Erhöht {stat}',
  'stat.atk': 'Ang', 'stat.def': 'Vert', 'stat.spa': 'Sp.-Ang', 'stat.spd': 'Sp.-Vert', 'stat.spe': 'Init',
  'notes.label': 'Notizen', 'notes.placeholder': 'Attacken, Item, alles Wichtige',
  'entry.permanent': 'Fest', 'entry.trialExpires': 'Probe bis {date}', 'entry.trialExpired': 'Probe abgelaufen am {date}',
  'entry.editCopy': '{label} bearbeiten', 'entry.save': 'Änderungen speichern', 'entry.saved': 'Änderungen gespeichert',
  'entry.delete': 'Aus dem Team entfernen', 'entry.deleted': '{name} entfernt',
  'form.entries': 'Deine {name}', 'form.copies': '{count} in deiner Box', 'form.copyLabel': 'Exemplar {n} von {total}', 'form.addAnother': 'Noch eins hinzufügen',
  'settings.open': 'Einstellungen', 'settings.title': 'Einstellungen', 'settings.theme': 'Darstellung',
  'settings.theme.system': 'Wie Gerät', 'settings.theme.light': 'Hell', 'settings.theme.dark': 'Dunkel',
  'settings.language': 'Sprache', 'settings.languageHint': 'Ändert App-Texte, Pokémon-Namen und die Suche.',
  'settings.disclaimer': 'RanchRadar ist ein Fanprojekt und steht in keiner Verbindung zu Nintendo, Game Freak, Creatures oder The Pokémon Company.',
  'update.available': 'Eine neue Version von RanchRadar ist bereit.', 'update.reload': 'Aktualisieren',
  'error.generic': 'Speichern fehlgeschlagen: {message}', 'loading': 'Dein Team wird geladen…',
};

const es: Messages = {
  'trial.days': 'quedan {count} d', 'trial.hours': 'quedan {count} h', 'trial.soon': '< 1 h', 'trial.expired': 'Caducado', 'trial.leftLong': 'Fin de la prueba: {time}',
  'app.tagline': 'Compara los reclutas de hoy con tu equipo.',
  'home': 'RanchRadar, volver a tu equipo',
  'search.label': 'Buscar Pokémon', 'search.placeholder': 'Buscar Pokémon', 'search.clear': 'Borrar búsqueda',
  'search.none': 'Ningún Pokémon permitido empieza por «{query}». Revisa la ortografía o cambia el idioma en Ajustes.',
  'results.count': '{count} resultados', 'results.one': '1 resultado', 'results.back': 'Volver a tu equipo',
  'roster.heading': 'Tu equipo', 'roster.count': '{count} Pokémon', 'roster.copies': '{count} en posesión',
  'roster.empty.title': 'Tu rancho está vacío', 'roster.empty.body': 'Busca un Pokémon arriba y toca + para añadirlo.',
  'roster.view': 'Vista del equipo', 'roster.view.grid': 'Cuadrícula', 'roster.view.list': 'Lista',
  'own.none': 'No lo tienes', 'own.summary': '{total} en posesión ({parts})', 'own.perm': '{count} perm.', 'own.trial': '{count} prueba', 'own.expired': '{count} caducado(s)',
  'add.permanent': 'Añadir {name} como permanente', 'add.trial': 'Añadir {name} de prueba', 'add.details': 'Añadir {name} con detalles',
  'add.title': 'Añadir {name}', 'add.submit': 'Añadir al equipo',
  'added.permanent': '{name} añadido como permanente', 'added.trial': '{name} añadido de prueba',
  'undo': 'Deshacer', 'cancel': 'Cancelar', 'close': 'Cerrar',
  'status.label': 'Estado', 'status.permanent': 'Permanente', 'status.trial': 'Prueba',
  'nature.label': 'Naturaleza', 'nature.none': 'Sin definir', 'nature.neutral': 'Neutra',
  'nature.sort': 'Ordenar naturalezas', 'nature.sort.az': 'A–Z', 'nature.sort.stat': 'Por estadística', 'nature.raises': 'Sube {stat}',
  'stat.atk': 'Atq', 'stat.def': 'Def', 'stat.spa': 'At. Esp.', 'stat.spd': 'Def. Esp.', 'stat.spe': 'Vel',
  'notes.label': 'Notas', 'notes.placeholder': 'Movimientos, objeto, lo que quieras recordar',
  'entry.permanent': 'Permanente', 'entry.trialExpires': 'Prueba hasta el {date}', 'entry.trialExpired': 'Prueba caducada el {date}',
  'entry.editCopy': 'Editar {label}', 'entry.save': 'Guardar cambios', 'entry.saved': 'Cambios guardados',
  'entry.delete': 'Quitar del equipo', 'entry.deleted': '{name} quitado',
  'form.entries': 'Tus {name}', 'form.copies': '{count} en tu caja', 'form.copyLabel': 'Ejemplar {n} de {total}', 'form.addAnother': 'Añadir otro',
  'settings.open': 'Ajustes', 'settings.title': 'Ajustes', 'settings.theme': 'Apariencia',
  'settings.theme.system': 'Como el dispositivo', 'settings.theme.light': 'Claro', 'settings.theme.dark': 'Oscuro',
  'settings.language': 'Idioma', 'settings.languageHint': 'Cambia el texto de la app, los nombres de los Pokémon y la búsqueda.',
  'settings.disclaimer': 'RanchRadar es un proyecto de fans, sin relación con Nintendo, Game Freak, Creatures ni The Pokémon Company.',
  'update.available': 'Hay una nueva versión de RanchRadar lista.', 'update.reload': 'Actualizar',
  'error.generic': 'No se pudo guardar: {message}', 'loading': 'Cargando tu equipo…',
};

const it: Messages = {
  'trial.days': '{count} g rimasti', 'trial.hours': '{count} h rimaste', 'trial.soon': '< 1 h', 'trial.expired': 'Scaduto', 'trial.leftLong': 'Fine prova: {time}',
  'app.tagline': 'Confronta le reclute di oggi con la tua squadra.',
  'home': 'RanchRadar, torna alla tua squadra',
  'search.label': 'Cerca Pokémon', 'search.placeholder': 'Cerca Pokémon', 'search.clear': 'Cancella ricerca',
  'search.none': 'Nessun Pokémon consentito inizia con «{query}». Controlla l’ortografia o cambia lingua nelle impostazioni.',
  'results.count': '{count} risultati', 'results.one': '1 risultato', 'results.back': 'Torna alla tua squadra',
  'roster.heading': 'La tua squadra', 'roster.count': '{count} Pokémon', 'roster.copies': '{count} posseduti',
  'roster.empty.title': 'Il tuo ranch è vuoto', 'roster.empty.body': 'Cerca un Pokémon qui sopra e tocca + per aggiungerlo.',
  'roster.view': 'Vista della squadra', 'roster.view.grid': 'Griglia', 'roster.view.list': 'Elenco',
  'own.none': 'Non posseduto', 'own.summary': '{total} posseduti ({parts})', 'own.perm': '{count} perm.', 'own.trial': '{count} prova', 'own.expired': '{count} scaduti',
  'add.permanent': 'Aggiungi {name} come permanente', 'add.trial': 'Aggiungi {name} in prova', 'add.details': 'Aggiungi {name} con dettagli',
  'add.title': 'Aggiungi {name}', 'add.submit': 'Aggiungi alla squadra',
  'added.permanent': '{name} aggiunto come permanente', 'added.trial': '{name} aggiunto in prova',
  'undo': 'Annulla', 'cancel': 'Annulla', 'close': 'Chiudi',
  'status.label': 'Stato', 'status.permanent': 'Permanente', 'status.trial': 'Prova',
  'nature.label': 'Natura', 'nature.none': 'Non impostata', 'nature.neutral': 'Neutra',
  'nature.sort': 'Ordina nature', 'nature.sort.az': 'A–Z', 'nature.sort.stat': 'Per statistica', 'nature.raises': 'Aumenta {stat}',
  'stat.atk': 'Att', 'stat.def': 'Dif', 'stat.spa': 'Att. Sp.', 'stat.spd': 'Dif. Sp.', 'stat.spe': 'Vel',
  'notes.label': 'Note', 'notes.placeholder': 'Mosse, strumento, qualsiasi cosa da ricordare',
  'entry.permanent': 'Permanente', 'entry.trialExpires': 'In prova fino al {date}', 'entry.trialExpired': 'Prova scaduta il {date}',
  'entry.editCopy': 'Modifica {label}', 'entry.save': 'Salva modifiche', 'entry.saved': 'Modifiche salvate',
  'entry.delete': 'Rimuovi dalla squadra', 'entry.deleted': '{name} rimosso',
  'form.entries': 'I tuoi {name}', 'form.copies': '{count} nel tuo box', 'form.copyLabel': 'Esemplare {n} di {total}', 'form.addAnother': 'Aggiungine un altro',
  'settings.open': 'Impostazioni', 'settings.title': 'Impostazioni', 'settings.theme': 'Aspetto',
  'settings.theme.system': 'Come il dispositivo', 'settings.theme.light': 'Chiaro', 'settings.theme.dark': 'Scuro',
  'settings.language': 'Lingua', 'settings.languageHint': 'Cambia i testi dell’app, i nomi dei Pokémon e la ricerca.',
  'settings.disclaimer': 'RanchRadar è un progetto di fan, non affiliato con Nintendo, Game Freak, Creatures o The Pokémon Company.',
  'update.available': 'È pronta una nuova versione di RanchRadar.', 'update.reload': 'Aggiorna',
  'error.generic': 'Impossibile salvare: {message}', 'loading': 'Caricamento della squadra…',
};

const dictionaries: Record<NameLocale, Messages> = {
  en, ja, ko, 'zh-Hant': zhHant, 'zh-Hans': zhHans, fr, de, es, it,
};

let current: NameLocale = 'en';

/** Called by the app whenever the language setting changes, before rendering. */
export function setUiLocale(locale: NameLocale): void {
  current = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

export function uiLocale(): NameLocale {
  return current;
}

export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  const template = dictionaries[current][key] ?? en[key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

/** Time left on a trial, e.g. "3d left", "5h left", "<1h left"; null when there's no active trial. */
export function trialTimeLeft(expiresAt: string | null, now: Date = new Date()): string | null {
  if (!expiresAt) return null;
  const hours = Math.floor((Date.parse(expiresAt) - now.getTime()) / 3_600_000);
  if (Date.parse(expiresAt) <= now.getTime()) return t('trial.expired');
  if (hours >= 48) return t('trial.days', { count: Math.floor(hours / 24) });
  if (hours >= 1) return t('trial.hours', { count: hours });
  return t('trial.soon');
}

/** "2 owned (1 perm, 1 trial)" in the current language. */
export function ownershipText(summary: { total: number; permanent: number; trial: number; expiredTrials: number } | undefined): string {
  if (!summary || summary.total === 0) return t('own.none');
  const parts: string[] = [];
  if (summary.permanent) parts.push(t('own.perm', { count: summary.permanent }));
  if (summary.trial) parts.push(t('own.trial', { count: summary.trial }));
  if (summary.expiredTrials) parts.push(t('own.expired', { count: summary.expiredTrials }));
  const separator = current === 'ja' || current.startsWith('zh') ? '、' : ', ';
  return t('own.summary', { total: summary.total, parts: parts.join(separator) });
}
