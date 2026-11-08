/* ==========================================================================
   St Paul's League — Modern Mobile App Client
   ========================================================================== */

const TAB_ORDER = ['home', 'table', 'fixtures', 'seasons', 'profile'];
const ROUTE_TO_TAB = {
	'/': 'home',
	'/table': 'table',
	'/fixtures': 'fixtures',
	'/seasons': 'seasons',
	'/profile': 'profile'
};
const TAB_TO_ROUTE = {
	home: '/',
	table: '/table',
	fixtures: '/fixtures',
	seasons: '/seasons',
	profile: '/profile'
};

const state = {
	activeTab: 'home',
	fixturesSegment: 'upcoming',
	tableSeasonMode: 'current', // 'current' | 'all-time' | 'season:<id>'
	tableSortField: 'points',
	tableSortAsc: false,

	// Authenticated User State
	isAuthenticated: false,
	authUser: null,
	profileDraft: {
		name: '',
		team: '',
		teamColor: '#ffffff'
	},

	// Live API Data
	users: [],
	userMap: new Map(),
	leaderboardRaw: [],
	leaderboardSorted: [],
	games: [],
	outstandingData: null,
	seasons: [],
	archivedDetails: new Map(), // seasonId -> { seasonInfo, leaderboard }
	allTimeLeaderboard: [],

	// Fixtures Filter State
	rematchRounds: 2,
	prioritiseFirstMatchups: true,
	availablePlayerIds: null, // null means all participating players available

	// Push Notifications
	pushSubscribed: false,
	vapidPublicKey: null
};

function escapeHTML(str) {
	if (str === undefined || str === null) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function getOrdinal(n) {
	const num = Number(n);
	if (!Number.isFinite(num) || num <= 0) return '—';
	const s = ['th', 'st', 'nd', 'rd'];
	const v = num % 100;
	return num + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatShortDate(dateStr, includeYear = false) {
	if (!dateStr) return '';
	const parts = String(dateStr).split('T')[0].split('-');
	if (parts.length === 3) {
		const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
		if (!isNaN(d.getTime())) {
			return d.toLocaleDateString('en-GB', {
				day: 'numeric',
				month: 'short',
				...(includeYear ? { year: 'numeric' } : {})
			});
		}
	}
	const fallback = new Date(dateStr);
	if (isNaN(fallback.getTime())) return String(dateStr);
	return fallback.toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		...(includeYear ? { year: 'numeric' } : {})
	});
}

function getGreetingTimeOfDay() {
	const hour = new Date().getHours();
	if (hour < 12) return 'Good morning';
	if (hour < 17) return 'Good afternoon';
	return 'Good evening';
}

function getCurrentSeasonNumber() {
	return (state.seasons?.length || 0) + 1;
}

function getAuthenticatedUser() {
	if (!state.authUser) return null;
	return state.userMap.get(state.authUser.id) || state.authUser;
}

let toastTimer = null;
function showToast(message) {
	const toast = document.getElementById('app-toast');
	if (!toast) return;
	toast.textContent = message;
	toast.hidden = false;
	requestAnimationFrame(() => {
		toast.classList.add('is-visible');
	});
	if (toastTimer) clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		toast.classList.remove('is-visible');
		setTimeout(() => {
			toast.hidden = true;
		}, 180);
	}, 2400);
}

/* ==========================================================================
   NAVIGATION & DIRECTIONAL PAGE WIPE ANIMATION
   ========================================================================== */

function switchTab(targetTab, { updateHistory = true } = {}) {
	if (!TAB_ORDER.includes(targetTab)) return;
	if (targetTab === state.activeTab) return;

	const prevIndex = TAB_ORDER.indexOf(state.activeTab);
	const nextIndex = TAB_ORDER.indexOf(targetTab);
	const goingRight = nextIndex > prevIndex;

	const currentViewEl = document.querySelector(`.app-view[data-view="${state.activeTab}"]`);
	const nextViewEl = document.querySelector(`.app-view[data-view="${targetTab}"]`);

	state.activeTab = targetTab;

	document.querySelectorAll('.nav-tab').forEach((btn) => {
		const isMatch = btn.dataset.target === targetTab;
		btn.classList.toggle('is-active', isMatch);
		if (isMatch) {
			btn.setAttribute('aria-current', 'page');
		} else {
			btn.removeAttribute('aria-current');
		}
	});

	if (updateHistory) {
		const route = TAB_TO_ROUTE[targetTab] || '/';
		if (window.location.pathname !== route) {
			window.history.pushState({ tab: targetTab }, '', route);
		}
	}

	if (!currentViewEl || !nextViewEl) return;

	document.querySelectorAll('.app-view').forEach((el) => {
		el.classList.remove('anim-enter-right', 'anim-exit-left', 'anim-enter-left', 'anim-exit-right');
		if (el !== currentViewEl && el !== nextViewEl) {
			el.classList.remove('is-active');
		}
	});

	const enterClass = goingRight ? 'anim-enter-right' : 'anim-enter-left';
	const exitClass = goingRight ? 'anim-exit-left' : 'anim-exit-right';

	nextViewEl.classList.add('is-active', enterClass);
	currentViewEl.classList.add(exitClass);

	setTimeout(() => {
		currentViewEl.classList.remove('is-active', exitClass);
		nextViewEl.classList.remove(enterClass);
	}, 200);
}

function switchFixturesSegment(segment) {
	if (segment !== 'upcoming' && segment !== 'results') return;
	state.fixturesSegment = segment;

	const control = document.querySelector('.segmented-control');
	if (control) {
		control.classList.toggle('is-results', segment === 'results');
	}

	document.querySelectorAll('.segment-btn').forEach((btn) => {
		const isMatch = btn.dataset.segment === segment;
		btn.classList.toggle('is-active', isMatch);
		btn.setAttribute('aria-selected', String(isMatch));
	});

	const upcomingPane = document.getElementById('fixtures-upcoming-pane');
	const resultsPane = document.getElementById('fixtures-results-pane');

	if (upcomingPane && resultsPane) {
		upcomingPane.classList.toggle('is-active', segment === 'upcoming');
		resultsPane.classList.toggle('is-active', segment === 'results');
	}
}

/* ==========================================================================
   AUTHENTICATION GATE & DATA LOADING FROM LIVE API
   ========================================================================== */

function setAuthenticatedUI(isAuthenticated) {
	const landingEl = document.getElementById('auth-landing');
	const viewportEl = document.getElementById('views-viewport');
	const bottomNavEl = document.getElementById('bottom-nav');
	const signInBtn = document.getElementById('auth-signin-btn');

	if (signInBtn) {
		signInBtn.href = `/auth/google/login?origin=${encodeURIComponent(window.location.origin)}`;
	}

	if (isAuthenticated) {
		if (landingEl) landingEl.hidden = true;
		if (viewportEl) viewportEl.hidden = false;
		if (bottomNavEl) bottomNavEl.hidden = false;
	} else {
		if (landingEl) landingEl.hidden = false;
		if (viewportEl) viewportEl.hidden = true;
		if (bottomNavEl) bottomNavEl.hidden = true;
	}
}

function computeSortedLeaderboard(statsArray, userMap) {
	if (!Array.isArray(statsArray)) return [];

	// Preserves the ordering and dense `position` calculated by the API backend single source of truth
	return statsArray.map((row, idx) => {
		const user = userMap.get(row.playerId) || row;
		const wins = Number(row.wins) || 0;
		const losses = Number(row.losses) || 0;
		const foulsOnBlack = Number(row.foulsOnBlack) || 0;
		const ballsRemaining = Number(row.ballsRemaining) || 0;
		const points = Number(row.points) || 0;
		const played = row.played !== undefined ? Number(row.played) : wins + losses;
		const position = row.position !== undefined ? Number(row.position) : idx + 1;

		return {
			playerId: row.playerId || user.id,
			name: row.name || user.name || 'Unknown',
			team: row.team || user.team || 'My Team',
			teamColor: row.teamColor || user.teamColor || '#ffffff',
			participating:
				row.participating !== undefined
					? Boolean(row.participating)
					: user.participating !== undefined
					? Boolean(user.participating)
					: true,
			wins,
			losses,
			foulsOnBlack,
			ballsRemaining,
			points,
			played,
			winLossRatio: row.winLossRatio,
			position,
			rank: position
		};
	});
}

async function fetchOutstandingGamesData() {
	const params = new URLSearchParams();
	params.set('rounds', String(state.rematchRounds));
	params.set('prioritiseFirstMatchups', String(state.prioritiseFirstMatchups));

	if (Array.isArray(state.availablePlayerIds)) {
		params.set('available', state.availablePlayerIds.join(','));
	}

	const res = await fetch(`/api/outstanding-games?${params.toString()}`);
	if (!res.ok) throw new Error('Failed to fetch outstanding games');
	state.outstandingData = await res.json();
}

async function checkAuthAndLoadApp() {
	try {
		const profileRes = await fetch('/api/auth/profile');
		if (!profileRes.ok) {
			state.isAuthenticated = false;
			state.authUser = null;
			setAuthenticatedUI(false);
			return;
		}

		const authProfile = await profileRes.json();
		if (!authProfile || !authProfile.id) {
			state.isAuthenticated = false;
			state.authUser = null;
			setAuthenticatedUI(false);
			return;
		}

		state.isAuthenticated = true;
		state.authUser = authProfile;
		state.profileDraft = {
			name: authProfile.name || '',
			team: authProfile.team || '',
			teamColor: authProfile.teamColor || '#ffffff'
		};

		setAuthenticatedUI(true);
		await loadLeagueData();
		await syncPushStatus();
	} catch (error) {
		console.error('Auth check error:', error);
		setAuthenticatedUI(false);
	}
}

async function loadLeagueData() {
	try {
		const [usersRes, leaderboardRes, gamesRes, seasonsRes, allTimeRes, profileRes] = await Promise.all([
			fetch('/api/users'),
			fetch('/api/leaderboard'),
			fetch('/api/game-list'),
			fetch('/api/seasons'),
			fetch('/api/all-time-leaderboard'),
			fetch('/api/auth/profile')
		]);

		if (profileRes.ok) {
			const freshProfile = await profileRes.json();
			if (freshProfile && freshProfile.id) {
				state.authUser = freshProfile;
				state.profileDraft = {
					name: freshProfile.name || '',
					team: freshProfile.team || '',
					teamColor: freshProfile.teamColor || '#ffffff'
				};
			}
		}

		if (usersRes.ok) {
			state.users = await usersRes.json();
			state.userMap = new Map(state.users.map((u) => [u.id, u]));
		}

		if (leaderboardRes.ok) {
			state.leaderboardRaw = await leaderboardRes.json();
		}

		if (gamesRes.ok) {
			state.games = await gamesRes.json();
		}

		if (seasonsRes.ok) {
			state.seasons = await seasonsRes.json();
		}

		if (allTimeRes.ok) {
			state.allTimeLeaderboard = await allTimeRes.json();
		}

		await fetchOutstandingGamesData();

		if (Array.isArray(state.seasons) && state.seasons.length > 0) {
			await Promise.all(
				state.seasons.map(async (s) => {
					try {
						const r = await fetch(`/api/archive/${encodeURIComponent(s.id)}`);
						if (r.ok) {
							const data = await r.json();
							state.archivedDetails.set(String(s.id), data);
						}
					} catch {
						// Ignore individual archive fetch failure
					}
				})
			);
		}

		recomputeAndRenderAll();
	} catch (error) {
		console.error('Error loading league data:', error);
		showToast('Could not load live league data');
	}
}

function recomputeAndRenderAll() {
	if (!state.isAuthenticated || !state.authUser) return;

	state.leaderboardSorted = computeSortedLeaderboard(state.leaderboardRaw, state.userMap);

	renderContextLabels();
	renderHomeView();
	renderTableView();
	renderFixturesView();
	renderSeasonsView();
	renderProfileView();
}

function renderContextLabels() {
	const seasonNum = getCurrentSeasonNumber();
	const defaultContextText = `Season ${seasonNum}`;

	document.querySelectorAll('[data-bind="context-label"]').forEach((el) => {
		if (el.id === 'fixtures-filter-label' && Array.isArray(state.availablePlayerIds)) {
			const totalPart = state.outstandingData?.participatingCount || state.users.filter((u) => u.participating).length;
			el.textContent = `${state.availablePlayerIds.length}/${totalPart} Players Ready`;
		} else {
			el.textContent = defaultContextText;
		}
	});
}

/* ==========================================================================
   1. RENDER HOME VIEW
   ========================================================================== */

function renderHomeView() {
	const currentUser = getAuthenticatedUser();
	if (!currentUser) return;

	const firstName = (currentUser.name || '').trim().split(/\s+/)[0] || 'Player';

	const greetingEl = document.getElementById('home-greeting');
	if (greetingEl) {
		greetingEl.textContent = `${getGreetingTimeOfDay()}, ${firstName}!`;
	}

	const allOutstanding = state.outstandingData?.games || [];
	const userNextFixture = allOutstanding.find(
		(g) => g.homePlayer.id === currentUser.id || g.awayPlayer.id === currentUser.id
	);

	const headlineEl = document.getElementById('home-hero-headline');
	const metaEl = document.getElementById('home-next-meta');
	const matchupEl = document.getElementById('home-next-matchup');
	const viewFixtureBtn = document.getElementById('home-view-fixture-btn');

	if (userNextFixture) {
		const isHome = userNextFixture.homePlayer.id === currentUser.id;
		const myPlayer = isHome ? userNextFixture.homePlayer : userNextFixture.awayPlayer;
		const oppPlayer = isHome ? userNextFixture.awayPlayer : userNextFixture.homePlayer;

		if (headlineEl) {
			headlineEl.innerHTML = 'A big night at<br />the table.';
		}
		if (metaEl) {
			metaEl.textContent = `${userNextFixture.roundName} • #${userNextFixture.order} in Queue`;
		}
		if (matchupEl) {
			matchupEl.textContent = `${myPlayer.team} vs ${oppPlayer.team}`;
		}
		if (viewFixtureBtn) {
			viewFixtureBtn.onclick = () => openFixtureSheet(userNextFixture);
		}
	} else {
		if (headlineEl) headlineEl.innerHTML = 'All caught up<br />at the table.';
		if (metaEl) metaEl.textContent = `Season ${getCurrentSeasonNumber()} • Complete`;
		if (matchupEl) matchupEl.textContent = 'No outstanding fixtures for your team';
		if (viewFixtureBtn) {
			viewFixtureBtn.onclick = () => switchTab('fixtures');
		}
	}

	// 3 Stat Cards: League Position, Points, Ball Difference (Balls Remaining)
	const playerStanding = state.leaderboardSorted.find((p) => p.playerId === currentUser.id);
	const posEl = document.getElementById('home-stat-pos');
	const ptsEl = document.getElementById('home-stat-pts');
	const ballsEl = document.getElementById('home-stat-balls');

	if (playerStanding) {
		if (posEl) posEl.textContent = getOrdinal(playerStanding.rank);
		if (ptsEl) ptsEl.textContent = String(playerStanding.points);
		if (ballsEl) ballsEl.textContent = String(playerStanding.ballsRemaining);
	} else {
		if (posEl) posEl.textContent = '—';
		if (ptsEl) ptsEl.textContent = '0';
		if (ballsEl) ballsEl.textContent = '0';
	}

	// Your Last Result Card
	const lastResultContainer = document.getElementById('home-last-result-container');
	if (!lastResultContainer) return;

	const userGames = state.games.filter(
		(g) => g.homePlayerId === currentUser.id || g.awayPlayerId === currentUser.id
	);
	const lastGame = userGames[0];

	if (!lastGame) {
		lastResultContainer.innerHTML = `
			<div class="surface-card last-result-card">
				<p class="result-date-eyebrow">NO RESULTS YET</p>
				<div class="result-main-row">
					<div>
						<p class="result-team-primary">${escapeHTML(currentUser.team)}</p>
						<p class="result-team-secondary">No matches logged for your team this season</p>
					</div>
				</div>
			</div>
		`;
		return;
	}

	const opponentId =
		lastGame.homePlayerId === currentUser.id ? lastGame.awayPlayerId : lastGame.homePlayerId;
	const opponentUser = state.userMap.get(opponentId) || { name: 'Unknown', team: 'Unknown' };

	const winnerId = lastGame.winnerHome ? lastGame.homePlayerId : lastGame.awayPlayerId;
	const didWin = winnerId === currentUser.id;

	const dateLabel = formatShortDate(lastGame.playedAt).toUpperCase();
	const blackStatusText = lastGame.fouledOnBlack ? 'Fouled on black' : 'Black potted';
	const ballsCount = Number(lastGame.ballsRemaining) || 0;
	const ballsText = `${ballsCount} ${ballsCount === 1 ? 'ball' : 'balls'} remaining`;

	lastResultContainer.innerHTML = `
		<div class="surface-card last-result-card" id="home-last-result-card">
			<p class="result-date-eyebrow">${escapeHTML(dateLabel)}</p>
			<div class="result-main-row">
				<div>
					<p class="result-team-primary">${escapeHTML(currentUser.team)}</p>
					<p class="result-team-secondary">vs ${escapeHTML(opponentUser.team)}</p>
				</div>
				<span class="status-pill ${didWin ? 'status-pill-won' : 'status-pill-lost'}">
					${didWin ? 'WON' : 'LOST'}
				</span>
			</div>
			<div class="result-footer-row">
				<span class="result-black-status">${escapeHTML(blackStatusText)}</span>
				<span class="result-balls-rem">${escapeHTML(ballsText)}</span>
			</div>
		</div>
	`;

	const cardEl = document.getElementById('home-last-result-card');
	if (cardEl) {
		cardEl.addEventListener('click', () => openResultDetailSheet(lastGame));
	}
}

/* ==========================================================================
   2. RENDER LEAGUE TABLE VIEW
   ========================================================================== */

function getTableRowsForCurrentMode() {
	if (state.tableSeasonMode === 'current') {
		return state.leaderboardSorted;
	}
	if (state.tableSeasonMode === 'all-time') {
		return computeSortedLeaderboard(state.allTimeLeaderboard, state.userMap);
	}
	if (state.tableSeasonMode.startsWith('season:')) {
		const seasonId = state.tableSeasonMode.split(':')[1];
		const archive = state.archivedDetails.get(String(seasonId));
		if (archive && Array.isArray(archive.leaderboard)) {
			return computeSortedLeaderboard(archive.leaderboard, state.userMap);
		}
	}
	return state.leaderboardSorted;
}

function renderTableView() {
	const currentUser = getAuthenticatedUser();
	if (!currentUser) return;

	const seasonNum = getCurrentSeasonNumber();
	const labelEl = document.getElementById('table-season-label');
	const headingEl = document.getElementById('table-standings-heading');
	const badgeEl = document.getElementById('table-live-badge');

	if (state.tableSeasonMode === 'current') {
		if (labelEl) labelEl.textContent = `Season ${seasonNum}`;
		if (headingEl) headingEl.textContent = 'The current standings';
		if (badgeEl) {
			badgeEl.textContent = 'LIVE';
			badgeEl.className = 'status-pill status-pill-live';
		}
	} else if (state.tableSeasonMode === 'all-time') {
		if (labelEl) labelEl.textContent = 'All-Time Standings';
		if (headingEl) headingEl.textContent = 'All-time standings';
		if (badgeEl) {
			badgeEl.textContent = 'ALL-TIME';
			badgeEl.className = 'status-pill status-pill-live';
		}
	} else if (state.tableSeasonMode.startsWith('season:')) {
		const seasonId = state.tableSeasonMode.split(':')[1];
		const archive = state.archivedDetails.get(String(seasonId));
		const seasonName = archive?.seasonInfo?.name || `Season ${seasonId}`;
		if (labelEl) labelEl.textContent = `${seasonName}`;
		if (headingEl) headingEl.textContent = 'Final standings';
		if (badgeEl) {
			badgeEl.textContent = 'FINAL';
			badgeEl.className = 'status-pill status-pill-live';
		}
	}

	const baseRows = getTableRowsForCurrentMode();
	let sortedRows;

	if (state.tableSortField === 'points') {
		sortedRows = state.tableSortAsc ? [...baseRows].reverse() : [...baseRows];
	} else {
		const dir = state.tableSortAsc ? 1 : -1;
		const f = state.tableSortField;
		sortedRows = [...baseRows].sort((a, b) => {
			if (a[f] !== b[f]) {
				return (a[f] - b[f]) * dir;
			}
			return (a.position || 0) - (b.position || 0);
		});
	}

	document.querySelectorAll('.sort-col-btn').forEach((btn) => {
		btn.classList.toggle('is-sorted', btn.dataset.sort === state.tableSortField);
	});

	const container = document.getElementById('standings-rows-container');
	if (container) {
		container.innerHTML = sortedRows
			.map((row) => {
				const isUser = row.playerId === currentUser.id;
				const displayRank = row.position;
				return `
					<button type="button" class="standings-row ${isUser ? 'is-user-team' : ''}" data-player-id="${escapeHTML(row.playerId)}">
						<span class="col-rank">${displayRank}</span>
						<span class="col-team">${escapeHTML(row.team)}</span>
						<span class="col-stat">${row.wins}</span>
						<span class="col-stat">${row.losses}</span>
						<span class="col-diff">${row.ballsRemaining}</span>
						<span class="col-pts">${row.points}</span>
					</button>
				`;
			})
			.join('');

		container.querySelectorAll('.standings-row').forEach((btn) => {
			btn.addEventListener('click', () => {
				const pid = btn.dataset.playerId;
				const rowObj = baseRows.find((r) => String(r.playerId) === String(pid));
				if (rowObj) openPlayerDetailSheet(rowObj);
			});
		});
	}

	// Render YOUR LAST 5 GAMES Card
	const userGames = state.games
		.filter((g) => g.homePlayerId === currentUser.id || g.awayPlayerId === currentUser.id)
		.slice(0, 5);

	const badgesContainer = document.getElementById('table-form-badges');
	const formHeadline = document.getElementById('table-form-headline');

	if (badgesContainer) {
		if (userGames.length === 0) {
			badgesContainer.innerHTML = Array.from({ length: 5 })
				.map(() => `<span class="form-badge form-badge-empty">-</span>`)
				.join('');
			if (formHeadline) formHeadline.innerHTML = 'Ready for<br />kickoff!';
		} else {
			const recentFive = [...userGames].reverse();
			let winsCount = 0;

			const badgesHtml = recentFive.map((g) => {
				const winnerId = g.winnerHome ? g.homePlayerId : g.awayPlayerId;
				const won = winnerId === currentUser.id;
				if (won) winsCount++;
				return `<span class="form-badge ${won ? 'form-badge-w' : 'form-badge-l'}">${won ? 'W' : 'L'}</span>`;
			});

			while (badgesHtml.length < 5) {
				badgesHtml.push(`<span class="form-badge form-badge-empty">-</span>`);
			}

			badgesContainer.innerHTML = badgesHtml.join('');

			if (formHeadline) {
				const winRate = winsCount / recentFive.length;
				if (winRate >= 0.6) {
					formHeadline.innerHTML = "You're on<br />a roll!";
				} else if (winRate >= 0.4) {
					formHeadline.innerHTML = 'Holding<br />steady!';
				} else {
					formHeadline.innerHTML = 'Due a big<br />comeback!';
				}
			}
		}
	}
}

/* ==========================================================================
   3. RENDER FIXTURES VIEW (UPCOMING & RESULTS)
   ========================================================================== */

function renderFixturesView() {
	const currentUser = getAuthenticatedUser();
	if (!currentUser) return;

	const upcomingGames = state.outstandingData?.games || [];
	const recordBtn = document.getElementById('record-match-btn');
	if (recordBtn) {
		recordBtn.hidden = !currentUser.participating;
	}

	// 1. Render Top Hero Card in Upcoming Pane (the logged-in user's next fixture)
	const heroContainer = document.getElementById('fixtures-hero-container');
	const userNext = upcomingGames.find(
		(g) => g.homePlayer.id === currentUser.id || g.awayPlayer.id === currentUser.id
	);

	if (heroContainer) {
		if (userNext) {
			const isHome = userNext.homePlayer.id === currentUser.id;
			const myP = isHome ? userNext.homePlayer : userNext.awayPlayer;
			const oppP = isHome ? userNext.awayPlayer : userNext.homePlayer;

			heroContainer.innerHTML = `
				<div class="hero-card fixture-next-hero" id="fixtures-next-hero-card">
					<div class="fixture-hero-top">
						<span class="hero-eyebrow">YOUR NEXT FIXTURE</span>
						<span class="fixture-hero-right-meta">${escapeHTML(userNext.roundName)} / Queue #${userNext.order}</span>
					</div>
					<h2 class="fixture-hero-team-main">${escapeHTML(myP.team)}</h2>
					<p class="fixture-hero-team-sub">vs ${escapeHTML(oppP.team)}</p>
					<div class="fixture-hero-divider"></div>
					<div class="fixture-hero-bottom">
						<span class="fixture-hero-venue">${escapeHTML(myP.name)} vs ${escapeHTML(oppP.name)}</span>
						<span class="fixture-hero-link">
							View fixture
							<svg class="arrow-ne-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
								<line x1="7" y1="17" x2="17" y2="7"></line>
								<polyline points="7 7 17 7 17 17"></polyline>
							</svg>
						</span>
					</div>
				</div>
			`;

			const heroCardEl = document.getElementById('fixtures-next-hero-card');
			if (heroCardEl) {
				heroCardEl.style.cursor = 'pointer';
				heroCardEl.addEventListener('click', () => openFixtureSheet(userNext));
			}
		} else {
			heroContainer.innerHTML = '';
		}
	}

	// 2. Render Upcoming Queue List
	const upcomingListEl = document.getElementById('fixtures-upcoming-list');
	if (upcomingListEl) {
		const queueList = userNext ? upcomingGames.filter((g) => g !== userNext) : upcomingGames;
		const listToRender = queueList.length > 0 ? queueList : upcomingGames;

		if (listToRender.length === 0) {
			upcomingListEl.innerHTML = `
				<div class="surface-card" style="padding: 24px; text-align: center; color: var(--text-secondary);">
					All scheduled fixtures for this round are complete!
				</div>
			`;
		} else {
			upcomingListEl.innerHTML = listToRender
				.map((game, idx) => {
					const homeP = game.homePlayer;
					const awayP = game.awayPlayer;
					const shortRound = game.roundName === 'First Match' ? 'Round 1' : game.roundName;

					return `
						<button type="button" class="fixture-item-card" data-upcoming-idx="${idx}">
							<div class="fixture-left-col">
								<span class="fixture-date-main">Game ${game.order}</span>
								<span class="fixture-time-sub">${escapeHTML(shortRound)}</span>
							</div>
							<div class="fixture-mid-col">
								<p class="fixture-teams-title">
									${escapeHTML(homeP.team)} vs<br />${escapeHTML(awayP.team)}
								</p>
								<p class="fixture-venue-sub">${escapeHTML(homeP.name)} vs ${escapeHTML(awayP.name)}</p>
							</div>
							<svg class="chevron-right-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<polyline points="9 18 15 12 9 6"></polyline>
							</svg>
						</button>
					`;
				})
				.join('');

			upcomingListEl.querySelectorAll('.fixture-item-card').forEach((card) => {
				card.addEventListener('click', () => {
					const idx = Number(card.dataset.upcomingIdx);
					const item = listToRender[idx];
					if (item) openFixtureSheet(item);
				});
			});
		}
	}

	// 3. Render Results List
	const resultsListEl = document.getElementById('fixtures-results-list');
	const resultsCountEl = document.getElementById('results-count-label');
	if (resultsCountEl) {
		resultsCountEl.textContent = `${state.games.length} completed ${state.games.length === 1 ? 'match' : 'matches'}`;
	}

	if (resultsListEl) {
		if (state.games.length === 0) {
			resultsListEl.innerHTML = `
				<div class="surface-card" style="padding: 24px; text-align: center; color: var(--text-secondary);">
					No match results recorded yet this season.
				</div>
			`;
		} else {
			resultsListEl.innerHTML = state.games
				.map((game, idx) => {
					const winnerId = game.winnerHome ? game.homePlayerId : game.awayPlayerId;
					const loserId = game.winnerHome ? game.awayPlayerId : game.homePlayerId;
					const winnerP = state.userMap.get(winnerId) || { name: 'Unknown', team: 'Unknown' };
					const loserP = state.userMap.get(loserId) || { name: 'Unknown', team: 'Unknown' };

					const shortDate = formatShortDate(game.playedAt);
					const finishSub = game.fouledOnBlack
						? 'Black foul'
						: `${game.ballsRemaining} ${game.ballsRemaining === 1 ? 'ball' : 'balls'} left`;

					return `
						<button type="button" class="fixture-item-card" data-result-idx="${idx}">
							<div class="fixture-left-col">
								<span class="fixture-date-main">${escapeHTML(shortDate)}</span>
								<span class="fixture-time-sub">${escapeHTML(finishSub)}</span>
							</div>
							<div class="fixture-mid-col">
								<p class="fixture-teams-title">
									${escapeHTML(winnerP.team)} def.<br />${escapeHTML(loserP.team)}
								</p>
								<p class="fixture-venue-sub">${escapeHTML(winnerP.name)} beat ${escapeHTML(loserP.name)}</p>
							</div>
							<svg class="chevron-right-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<polyline points="9 18 15 12 9 6"></polyline>
							</svg>
						</button>
					`;
				})
				.join('');

			resultsListEl.querySelectorAll('.fixture-item-card').forEach((card) => {
				card.addEventListener('click', () => {
					const idx = Number(card.dataset.resultIdx);
					const game = state.games[idx];
					if (game) openResultDetailSheet(game);
				});
			});
		}
	}
}

/* ==========================================================================
   4. RENDER SEASONS VIEW
   ========================================================================== */

function renderSeasonsView() {
	const currentUser = getAuthenticatedUser();
	if (!currentUser) return;

	const archivedSeasons = state.seasons || [];
	const totalSeasonsCount = archivedSeasons.length + 1;

	const countBadge = document.getElementById('seasons-count-badge');
	if (countBadge) {
		countBadge.textContent = `${totalSeasonsCount} ${totalSeasonsCount === 1 ? 'SEASON' : 'SEASONS'}`;
	}

	// Reigning Champions Hero Card (from most recent archived season)
	const latestSeason = archivedSeasons[0];
	if (latestSeason) {
		const archiveData = state.archivedDetails.get(String(latestSeason.id));
		if (archiveData && Array.isArray(archiveData.leaderboard) && archiveData.leaderboard.length > 0) {
			const sortedArchive = computeSortedLeaderboard(archiveData.leaderboard, state.userMap);
			const champion = sortedArchive[0];
			const champTeamEl = document.getElementById('champion-team-name');
			const champSeasonEl = document.getElementById('champion-season-name');
			const champSummaryEl = document.getElementById('champion-points-line');

			if (champTeamEl) champTeamEl.textContent = champion.team;
			if (champSeasonEl) champSeasonEl.textContent = latestSeason.name.replace('/', '-');
			if (champSummaryEl) {
				champSummaryEl.textContent = `${champion.team} won with ${champion.points} points.`;
			}
		}
	}

	const archiveListEl = document.getElementById('seasons-archive-list');
	if (!archiveListEl) return;

	const cardsHtml = [];

	// 1. Current Season Card
	const userCurrentStanding = state.leaderboardSorted.find((p) => p.playerId === currentUser.id);
	const currentPosText = userCurrentStanding
		? `Your team is currently ${getOrdinal(userCurrentStanding.rank)}`
		: 'Season in progress';
	const currentPts = userCurrentStanding ? userCurrentStanding.points : 0;

	cardsHtml.push(`
		<button type="button" class="season-archive-card accent-current" data-season-mode="current">
			<div class="season-card-left">
				<p class="season-card-eyebrow">CURRENT SEASON</p>
				<p class="season-card-winner">TBD</p>
				<p class="season-card-status">${escapeHTML(currentPosText)}</p>
			</div>
			<div class="season-card-right">
				<div class="season-pts-block">
					<span class="season-pts-val">${currentPts}</span>
					<span class="season-pts-lbl">PTS</span>
				</div>
				<svg class="chevron-right-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<polyline points="9 18 15 12 9 6"></polyline>
				</svg>
			</div>
		</button>
	`);

	// 2. Archived Season Cards
	for (const season of archivedSeasons) {
		const archiveData = state.archivedDetails.get(String(season.id));
		const sortedArchive =
			archiveData && Array.isArray(archiveData.leaderboard)
				? computeSortedLeaderboard(archiveData.leaderboard, state.userMap)
				: [];

		const champion = sortedArchive[0];
		const userRow = sortedArchive.find((p) => p.playerId === currentUser.id);

		const didUserWin = userRow && userRow.rank === 1;
		const statusLine = userRow
			? didUserWin
				? 'Your team won'
				: `Your team finished ${getOrdinal(userRow.rank)}`
			: champion
			? `Won by ${champion.team}`
			: 'Archived standings';

		const ptsToDisplay = userRow ? userRow.points : champion ? champion.points : 0;
		const seasonTitleUpper = season.name.replace('/', '-').toUpperCase();

		cardsHtml.push(`
			<button type="button" class="season-archive-card ${didUserWin ? 'accent-gold' : ''}" data-season-mode="season:${escapeHTML(season.id)}">
				<div class="season-card-left">
					<p class="season-card-eyebrow">${escapeHTML(seasonTitleUpper)}</p>
					<p class="season-card-winner">${escapeHTML(champion ? champion.team : 'Champion')}</p>
					<p class="season-card-status">${escapeHTML(statusLine)}</p>
				</div>
				<div class="season-card-right">
					<div class="season-pts-block">
						<span class="season-pts-val">${ptsToDisplay}</span>
						<span class="season-pts-lbl">PTS</span>
					</div>
					<svg class="chevron-right-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<polyline points="9 18 15 12 9 6"></polyline>
					</svg>
				</div>
			</button>
		`);
	}

	archiveListEl.innerHTML = cardsHtml.join('');

	archiveListEl.querySelectorAll('.season-archive-card').forEach((card) => {
		card.addEventListener('click', () => {
			const mode = card.dataset.seasonMode || 'current';
			state.tableSeasonMode = mode;
			renderTableView();
			switchTab('table');
		});
	});
}

/* ==========================================================================
   5. RENDER PROFILE VIEW & WEB PUSH NOTIFICATIONS
   ========================================================================== */

function getMemberSinceYear(playerId) {
	// Derive earliest season year from archived seasons if present
	const sortedSeasonsAsc = [...(state.seasons || [])].sort((a, b) => Number(a.id) - Number(b.id));
	for (const s of sortedSeasonsAsc) {
		const arch = state.archivedDetails.get(String(s.id));
		if (arch?.leaderboard?.some((r) => String(r.playerId) === String(playerId))) {
			const yearMatch = String(s.name).match(/20\d{2}/);
			if (yearMatch) return yearMatch[0];
		}
	}
	return String(new Date().getFullYear());
}

function renderProfileView() {
	const currentUser = getAuthenticatedUser();
	if (!currentUser) return;

	const sinceYear = getMemberSinceYear(currentUser.id);
	const draft = state.profileDraft;

	const heroName = document.getElementById('profile-hero-name');
	const heroTeam = document.getElementById('profile-hero-team');
	const heroSince = document.getElementById('profile-hero-since');
	const dispNameVal = document.getElementById('profile-display-name-val');
	const teamNameVal = document.getElementById('profile-team-name-val');
	const colorDot = document.getElementById('profile-team-color-dot');
	const notifVal = document.getElementById('profile-notifications-val');

	if (heroName) heroName.textContent = currentUser.name;
	if (heroTeam) heroTeam.textContent = currentUser.team;
	if (heroSince) heroSince.textContent = `MEMBER SINCE ${sinceYear}`;

	if (dispNameVal) dispNameVal.textContent = draft.name || currentUser.name;
	if (teamNameVal) teamNameVal.textContent = draft.team || currentUser.team;
	if (colorDot) colorDot.style.backgroundColor = draft.teamColor || currentUser.teamColor || '#ffffff';
	if (notifVal) notifVal.textContent = state.pushSubscribed ? 'On' : 'Off';
}

function urlB64ToUint8Array(base64String) {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

async function getSWRegistration(timeoutMs = 4000) {
	if (!('serviceWorker' in navigator)) return null;
	try {
		return await Promise.race([
			navigator.serviceWorker.ready,
			new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
		]);
	} catch {
		return await navigator.serviceWorker.getRegistration();
	}
}

async function syncPushStatus() {
	if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
		state.pushSubscribed = false;
		renderProfileView();
		return;
	}

	try {
		const reg = await getSWRegistration();
		const sub = reg ? await reg.pushManager.getSubscription() : null;
		state.pushSubscribed = Boolean(sub && Notification.permission === 'granted');
	} catch {
		state.pushSubscribed = false;
	}
	renderProfileView();
}

async function handleToggleNotifications() {
	if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
		showToast('Install this app to your Home Screen to enable push notifications');
		return;
	}

	try {
		if (!state.vapidPublicKey) {
			const cfgRes = await fetch('/api/push-config');
			if (cfgRes.ok) {
				const cfg = await cfgRes.json();
				state.vapidPublicKey = cfg.publicKey;
			}
		}

		let reg = await getSWRegistration();
		if (!reg) {
			reg = await navigator.serviceWorker.register('/sw.js');
			await navigator.serviceWorker.ready;
		}

		const existingSub = reg ? await reg.pushManager.getSubscription() : null;

		if (existingSub) {
			await fetch('/api/push-unsubscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ endpoint: existingSub.endpoint })
			}).catch(() => {});
			await existingSub.unsubscribe();
			state.pushSubscribed = false;
			renderProfileView();
			showToast('Notifications turned Off');
		} else {
			if (!state.vapidPublicKey) {
				showToast('Push configuration key unavailable');
				return;
			}

			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				showToast('Notification permission was not granted');
				await syncPushStatus();
				return;
			}

			const newSub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlB64ToUint8Array(state.vapidPublicKey)
			});

			const res = await fetch('/api/auth/push-subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newSub)
			});

			if (!res.ok) {
				throw new Error('Failed to save push subscription on server');
			}

			state.pushSubscribed = true;
			renderProfileView();
			showToast('Notifications turned On');
		}
	} catch (error) {
		console.error('Push toggle error:', error);
		showToast(error.message || 'Could not update notifications');
	}
}

/* ==========================================================================
   BOTTOM SHEET MODALS
   ========================================================================== */

let closeSheetTimer = null;

function openBottomSheet(innerHtml, onMount) {
	const backdrop = document.getElementById('sheet-backdrop');
	const sheet = document.getElementById('bottom-sheet');
	const content = document.getElementById('sheet-content');
	if (!backdrop || !content) return;

	if (closeSheetTimer) {
		clearTimeout(closeSheetTimer);
		closeSheetTimer = null;
	}

	if (sheet) {
		sheet.classList.remove('is-dragging');
		sheet.style.transform = '';
	}
	backdrop.classList.remove('is-dragging');
	backdrop.style.opacity = '';

	content.innerHTML = innerHtml;
	content.scrollTop = 0;
	backdrop.hidden = false;
	requestAnimationFrame(() => {
		backdrop.classList.add('is-open');
	});

	if (typeof onMount === 'function') {
		onMount(content);
	}
}

function closeBottomSheet() {
	const backdrop = document.getElementById('sheet-backdrop');
	const sheet = document.getElementById('bottom-sheet');
	if (!backdrop || backdrop.hidden) return;

	if (sheet) {
		sheet.classList.remove('is-dragging');
		sheet.style.transform = '';
	}
	backdrop.classList.remove('is-dragging');
	backdrop.style.opacity = '';
	backdrop.classList.remove('is-open');

	if (closeSheetTimer) {
		clearTimeout(closeSheetTimer);
	}
	closeSheetTimer = setTimeout(() => {
		backdrop.hidden = true;
		closeSheetTimer = null;
	}, 220);
}

function initBottomSheetDrag() {
	const backdrop = document.getElementById('sheet-backdrop');
	const sheet = document.getElementById('bottom-sheet');
	const content = document.getElementById('sheet-content');
	if (!backdrop || !sheet || !content) return;

	let isTracking = false;
	let isDragging = false;
	let startedOnHandle = false;
	let startX = 0;
	let startY = 0;
	let dragOriginY = 0;
	let deltaY = 0;
	let lastY = 0;
	let lastTime = 0;
	let velocityY = 0;
	let suppressNextClick = false;

	const beginTrack = (clientX, clientY, target) => {
		if (backdrop.hidden || !backdrop.classList.contains('is-open')) return false;
		// Do not hijack gestures inside form fields
		if (target.closest('input, textarea, select')) return false;

		startedOnHandle = Boolean(target.closest('.sheet-handle-bar, .sheet-title'));
		// If starting inside scrollable content, only allow when scrolled to the very top
		if (!startedOnHandle && content.scrollTop > 0) return false;

		isTracking = true;
		isDragging = false;
		startX = clientX;
		startY = clientY;
		dragOriginY = clientY;
		deltaY = 0;
		lastY = clientY;
		lastTime = performance.now();
		velocityY = 0;
		return true;
	};

	const updateTrack = (clientX, clientY, event) => {
		if (!isTracking) return;

		const rawDx = clientX - startX;
		const rawDy = clientY - startY;

		if (!isDragging) {
			// Ignore predominantly horizontal swipes
			if (Math.abs(rawDx) > Math.abs(rawDy) && Math.abs(rawDx) > 8) {
				isTracking = false;
				return;
			}

			if (startedOnHandle) {
				if (Math.abs(rawDy) < 4) return;
			} else {
				// Inside sheet content: only engage drag when pulling downward at scrollTop === 0
				if (content.scrollTop > 0 || rawDy < 0) {
					if (rawDy < -4) isTracking = false;
					return;
				}
				if (rawDy < 7) return;
			}

			isDragging = true;
			dragOriginY = clientY;
			lastY = clientY;
			lastTime = performance.now();
			sheet.classList.add('is-dragging');
			backdrop.classList.add('is-dragging');
		}

		if (event && event.cancelable) {
			event.preventDefault();
		}

		const now = performance.now();
		const dt = now - lastTime;
		if (dt > 0) {
			const instantVy = (clientY - lastY) / dt; // px per ms
			velocityY = velocityY * 0.35 + instantVy * 0.65;
			lastY = clientY;
			lastTime = now;
		}

		deltaY = clientY - dragOriginY;
		const sheetHeight = sheet.offsetHeight || 320;

		if (deltaY >= 0) {
			sheet.style.transform = `translate3d(0, ${deltaY}px, 0)`;
			const progress = Math.min(1, deltaY / Math.max(sheetHeight, 260));
			backdrop.style.opacity = String(Math.max(0, 1 - progress * 0.85));
		} else {
			// Subtle upward rubber-band resistance
			const dampedUp = -Math.min(22, Math.pow(Math.abs(deltaY), 0.65) * 1.25);
			sheet.style.transform = `translate3d(0, ${dampedUp}px, 0)`;
			backdrop.style.opacity = '1';
		}
	};

	const endTrack = (cancelled = false) => {
		if (!isTracking) return;
		isTracking = false;

		if (!isDragging) return;
		isDragging = false;
		suppressNextClick = true;

		const sheetHeight = sheet.offsetHeight || 320;
		const dismissDistance = Math.min(105, Math.max(64, sheetHeight * 0.25));
		const isDownwardFlick = velocityY > 0.42 && deltaY > 22;
		const shouldDismiss = !cancelled && ((deltaY >= dismissDistance && velocityY > -0.25) || isDownwardFlick);

		if (shouldDismiss) {
			closeBottomSheet();
		} else {
			// Spring back to open state using CSS var(--ease-snappy)
			sheet.classList.remove('is-dragging');
			backdrop.classList.remove('is-dragging');
			sheet.style.transform = '';
			backdrop.style.opacity = '';
		}
	};

	// Touch listeners (iOS / Android PWA)
	sheet.addEventListener(
		'touchstart',
		(e) => {
			if (e.touches.length !== 1) return;
			const touch = e.touches[0];
			beginTrack(touch.clientX, touch.clientY, e.target);
		},
		{ passive: true }
	);

	sheet.addEventListener(
		'touchmove',
		(e) => {
			if (!isTracking || e.touches.length !== 1) return;
			const touch = e.touches[0];
			updateTrack(touch.clientX, touch.clientY, e);
		},
		{ passive: false }
	);

	sheet.addEventListener('touchend', () => endTrack(false));
	sheet.addEventListener('touchcancel', () => endTrack(true));

	// Mouse drag support for desktop/testing on the handle bar
	let activeMouseMove = null;
	let activeMouseUp = null;

	sheet.addEventListener('mousedown', (e) => {
		if (e.button !== 0) return;
		if (!e.target.closest('.sheet-handle-bar, .sheet-title')) return;
		if (!beginTrack(e.clientX, e.clientY, e.target)) return;

		activeMouseMove = (moveEvent) => {
			updateTrack(moveEvent.clientX, moveEvent.clientY, moveEvent);
		};
		activeMouseUp = () => {
			window.removeEventListener('mousemove', activeMouseMove);
			window.removeEventListener('mouseup', activeMouseUp);
			activeMouseMove = null;
			activeMouseUp = null;
			endTrack(false);
		};

		window.addEventListener('mousemove', activeMouseMove);
		window.addEventListener('mouseup', activeMouseUp);
	});

	// Prevent accidental click trigger immediately after releasing a drag
	sheet.addEventListener(
		'click',
		(e) => {
			if (suppressNextClick) {
				suppressNextClick = false;
				e.stopPropagation();
				e.preventDefault();
			}
		},
		true
	);
}

// 1. Table Season Selector Sheet
function openTableSeasonSheet() {
	const seasonNum = getCurrentSeasonNumber();
	const options = [
		{
			mode: 'current',
			title: `Season ${seasonNum}`,
			sub: 'Live current season standings'
		},
		...(state.seasons || []).map((s) => ({
			mode: `season:${s.id}`,
			title: `${s.name}`,
			sub: 'Archived final standings'
		})),
		{
			mode: 'all-time',
			title: 'All-Time Standings',
			sub: 'Combined career statistics across all seasons'
		}
	];

	const html = `
		<h3 class="sheet-title">Select Standings</h3>
		<p class="sheet-subtitle">Switch between live Season ${seasonNum}, archived seasons, or all-time rankings.</p>
		<div class="sheet-option-list">
			${options
				.map(
					(opt) => `
				<button type="button" class="sheet-option-btn ${state.tableSeasonMode === opt.mode ? 'is-selected' : ''}" data-table-mode="${escapeHTML(opt.mode)}">
					<div>
						<p class="sheet-option-title">${escapeHTML(opt.title)}</p>
						<p class="sheet-option-sub">${escapeHTML(opt.sub)}</p>
					</div>
				</button>
			`
				)
				.join('')}
		</div>
		<div class="sheet-actions-row">
			<button type="button" class="sheet-secondary-btn" data-close-sheet>Cancel</button>
		</div>
	`;

	openBottomSheet(html, (root) => {
		root.querySelectorAll('[data-table-mode]').forEach((btn) => {
			btn.addEventListener('click', () => {
				state.tableSeasonMode = btn.dataset.tableMode;
				renderTableView();
				closeBottomSheet();
				if (state.activeTab !== 'table') {
					switchTab('table');
				}
			});
		});
		root.querySelector('[data-close-sheet]')?.addEventListener('click', closeBottomSheet);
	});
}

// 2. Fixtures Filter & Available Players Sheet
function openFixturesFilterSheet() {
	const participating = state.users.filter((u) => u.participating);
	const currentAvailSet = new Set(
		Array.isArray(state.availablePlayerIds)
			? state.availablePlayerIds
			: participating.map((u) => u.id)
	);

	const html = `
		<h3 class="sheet-title">Table Night Availability</h3>
		<p class="sheet-subtitle">Select who is at the table right now to dynamically prioritise upcoming fixtures.</p>

		<div class="sheet-form-group">
			<label class="sheet-form-label" for="sheet-rounds-select">Rematch Rounds Target</label>
			<select id="sheet-rounds-select" class="sheet-select">
				<option value="1" ${state.rematchRounds === 1 ? 'selected' : ''}>1 Round (Single Matchup)</option>
				<option value="2" ${state.rematchRounds === 2 ? 'selected' : ''}>2 Rounds (Home & Away)</option>
				<option value="3" ${state.rematchRounds === 3 ? 'selected' : ''}>3 Rounds (Triple)</option>
				<option value="4" ${state.rematchRounds === 4 ? 'selected' : ''}>4 Rounds</option>
			</select>
		</div>

		<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
			<span class="sheet-form-label" style="margin-bottom: 0;">AVAILABLE PLAYERS</span>
			<div style="display: flex; gap: 10px;">
				<button type="button" id="avail-all-btn" style="font-size: 12px; font-weight: 700; color: var(--bg-hero);">Select All</button>
				<button type="button" id="avail-none-btn" style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">Clear</button>
			</div>
		</div>

		<div class="sheet-option-list" id="sheet-avail-list">
			${participating
				.map((p) => {
					const checked = currentAvailSet.has(p.id);
					return `
						<div class="avail-player-row ${checked ? 'is-checked' : ''}" data-avail-id="${escapeHTML(p.id)}">
							<div class="avail-player-left">
								<span class="team-color-dot" style="background-color: ${escapeHTML(p.teamColor)};"></span>
								<div>
									<p class="sheet-option-title">${escapeHTML(p.team)}</p>
									<p class="sheet-option-sub">${escapeHTML(p.name)}</p>
								</div>
							</div>
							<span class="avail-check-indicator">✓</span>
						</div>
					`;
				})
				.join('')}
		</div>

		<div class="sheet-actions-row">
			<button type="button" class="sheet-secondary-btn" data-close-sheet>Cancel</button>
			<button type="button" id="apply-avail-btn" class="lime-cta-btn" style="flex: 1.5; justify-content: center;">
				Apply Filter
			</button>
		</div>
	`;

	openBottomSheet(html, (root) => {
		root.querySelectorAll('.avail-player-row').forEach((row) => {
			row.addEventListener('click', () => {
				row.classList.toggle('is-checked');
			});
		});

		root.querySelector('#avail-all-btn')?.addEventListener('click', () => {
			root.querySelectorAll('.avail-player-row').forEach((r) => r.classList.add('is-checked'));
		});

		root.querySelector('#avail-none-btn')?.addEventListener('click', () => {
			root.querySelectorAll('.avail-player-row').forEach((r) => r.classList.remove('is-checked'));
		});

		root.querySelector('#apply-avail-btn')?.addEventListener('click', async () => {
			const roundsVal = Number(root.querySelector('#sheet-rounds-select')?.value || 2);
			const checkedIds = Array.from(root.querySelectorAll('.avail-player-row.is-checked')).map(
				(r) => r.dataset.availId
			);

			if (checkedIds.length < 2) {
				showToast('Select at least 2 available players');
				return;
			}

			state.rematchRounds = roundsVal;
			state.availablePlayerIds = checkedIds.length === participating.length ? null : checkedIds;

			closeBottomSheet();
			await fetchOutstandingGamesData();
			recomputeAndRenderAll();
			showToast('Fixtures queue updated');
		});

		root.querySelector('[data-close-sheet]')?.addEventListener('click', closeBottomSheet);
	});
}

// 3. Fixture Preview & Log Match Sheet
function openFixtureSheet(fixture) {
	const currentUser = getAuthenticatedUser();
	const canLogGames = Boolean(currentUser?.participating);
	const homeP = fixture.homePlayer;
	const awayP = fixture.awayPlayer;

	let homeWinsH2H = 0;
	let awayWinsH2H = 0;
	for (const g of state.games) {
		const isPair =
			(g.homePlayerId === homeP.id && g.awayPlayerId === awayP.id) ||
			(g.homePlayerId === awayP.id && g.awayPlayerId === homeP.id);
		if (isPair) {
			const wId = g.winnerHome ? g.homePlayerId : g.awayPlayerId;
			if (wId === homeP.id) homeWinsH2H++;
			else awayWinsH2H++;
		}
	}

	const todayIso = new Date().toISOString().split('T')[0];

	const html = `
		<p class="eyebrow">${escapeHTML(fixture.roundName)} • QUEUE #${fixture.order}</p>
		<h3 class="sheet-title" style="margin-bottom: 14px;">${escapeHTML(homeP.team)} vs ${escapeHTML(awayP.team)}</h3>

		<div class="h2h-card">
			<div>
				<p class="h2h-team-name">${escapeHTML(homeP.team)}</p>
				<p class="h2h-player-name">${escapeHTML(homeP.name)} (${fixture.homePlayerGames ?? 0} played)</p>
			</div>
			<span class="h2h-score-pill">${homeWinsH2H} – ${awayWinsH2H}</span>
			<div>
				<p class="h2h-team-name">${escapeHTML(awayP.team)}</p>
				<p class="h2h-player-name">${escapeHTML(awayP.name)} (${fixture.awayPlayerGames ?? 0} played)</p>
			</div>
		</div>

		${
			canLogGames
				? `
			<p class="sheet-form-label">RECORD MATCH RESULT</p>
			<div class="sheet-form-group">
				<span class="sheet-form-label" style="font-size: 11px;">Winner</span>
				<div class="sheet-toggle-grid">
					<button type="button" class="sheet-choice-btn is-active" data-winner="home">
						${escapeHTML(homeP.team)}
					</button>
					<button type="button" class="sheet-choice-btn" data-winner="away">
						${escapeHTML(awayP.team)}
					</button>
				</div>
			</div>

			<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
				<div class="sheet-form-group">
					<label class="sheet-form-label" for="log-balls-rem">Balls Remaining (0–8)</label>
					<input type="number" id="log-balls-rem" class="sheet-input" min="0" max="8" value="1" />
				</div>
				<div class="sheet-form-group">
					<label class="sheet-form-label" for="log-date-played">Date Played</label>
					<input type="date" id="log-date-played" class="sheet-input" value="${todayIso}" max="${todayIso}" />
				</div>
			</div>

			<div class="avail-player-row" id="log-foul-toggle" style="margin-bottom: 6px;">
				<div class="avail-player-left">
					<div>
						<p class="sheet-option-title">Fouled on the black</p>
						<p class="sheet-option-sub">Deducts 1 point from loser's tally</p>
					</div>
				</div>
				<span class="avail-check-indicator">✓</span>
			</div>

			<div class="sheet-actions-row">
				<button type="button" class="sheet-secondary-btn" data-close-sheet>Close</button>
				<button type="button" id="submit-fixture-result-btn" class="lime-cta-btn" style="flex: 1.6; justify-content: center;">
					Save Result
				</button>
			</div>
		`
				: `
			<div class="sheet-actions-row">
				<button type="button" class="sheet-secondary-btn" data-close-sheet>Close</button>
			</div>
		`
		}
	`;

	openBottomSheet(html, (root) => {
		let winnerHome = true;

		root.querySelectorAll('[data-winner]').forEach((btn) => {
			btn.addEventListener('click', () => {
				winnerHome = btn.dataset.winner === 'home';
				root.querySelectorAll('[data-winner]').forEach((b) => {
					b.classList.toggle('is-active', b === btn);
				});
			});
		});

		const foulRow = root.querySelector('#log-foul-toggle');
		foulRow?.addEventListener('click', () => {
			foulRow.classList.toggle('is-checked');
		});

		root.querySelector('#submit-fixture-result-btn')?.addEventListener('click', async () => {
			const ballsRemaining = Number(root.querySelector('#log-balls-rem')?.value ?? 0);
			const playedAt = root.querySelector('#log-date-played')?.value || todayIso;
			const fouledOnBlack = Boolean(foulRow?.classList.contains('is-checked'));

			if (!Number.isInteger(ballsRemaining) || ballsRemaining < 0 || ballsRemaining > 8) {
				showToast('Balls remaining must be 0 to 8');
				return;
			}

			await submitNewGame({
				homePlayerId: homeP.id,
				awayPlayerId: awayP.id,
				winnerHome,
				ballsRemaining,
				fouledOnBlack,
				playedAt
			});
		});

		root.querySelector('[data-close-sheet]')?.addEventListener('click', closeBottomSheet);
	});
}

// 4. Full Match Logger Sheet (selectable Player 1 & Player 2)
function openLogGameSheet() {
	const currentUser = getAuthenticatedUser();
	if (!currentUser?.participating) {
		showToast('Only participating players can log matches');
		return;
	}

	const participating = state.users.filter((u) => u.participating);
	if (participating.length < 2) {
		showToast('At least 2 participating players required');
		return;
	}

	const defaultHome = participating.find((u) => u.id === currentUser.id) || participating[0];
	const defaultAway = participating.find((u) => u.id !== defaultHome.id) || participating[1];
	const todayIso = new Date().toISOString().split('T')[0];

	const html = `
		<h3 class="sheet-title">Record Match Result</h3>
		<p class="sheet-subtitle">Log a completed league game.</p>

		<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
			<div class="sheet-form-group">
				<label class="sheet-form-label" for="custom-home-select">Player 1</label>
				<select id="custom-home-select" class="sheet-select">
					${participating
						.map(
							(u) =>
								`<option value="${escapeHTML(u.id)}" ${u.id === defaultHome.id ? 'selected' : ''}>${escapeHTML(u.team)} (${escapeHTML(u.name)})</option>`
						)
						.join('')}
				</select>
			</div>
			<div class="sheet-form-group">
				<label class="sheet-form-label" for="custom-away-select">Player 2</label>
				<select id="custom-away-select" class="sheet-select">
					${participating
						.map(
							(u) =>
								`<option value="${escapeHTML(u.id)}" ${u.id === defaultAway.id ? 'selected' : ''}>${escapeHTML(u.team)} (${escapeHTML(u.name)})</option>`
						)
						.join('')}
				</select>
			</div>
		</div>

		<div class="sheet-form-group">
			<span class="sheet-form-label">Winner</span>
			<div class="sheet-toggle-grid">
				<button type="button" id="custom-win-home-btn" class="sheet-choice-btn is-active" data-winner="home">
					${escapeHTML(defaultHome.team)}
				</button>
				<button type="button" id="custom-win-away-btn" class="sheet-choice-btn" data-winner="away">
					${escapeHTML(defaultAway.team)}
				</button>
			</div>
		</div>

		<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
			<div class="sheet-form-group">
				<label class="sheet-form-label" for="custom-balls-rem">Balls Remaining (0–8)</label>
				<input type="number" id="custom-balls-rem" class="sheet-input" min="0" max="8" value="1" />
			</div>
			<div class="sheet-form-group">
				<label class="sheet-form-label" for="custom-date-played">Date Played</label>
				<input type="date" id="custom-date-played" class="sheet-input" value="${todayIso}" max="${todayIso}" />
			</div>
		</div>

		<div class="avail-player-row" id="custom-foul-toggle" style="margin-bottom: 6px;">
			<div class="avail-player-left">
				<div>
					<p class="sheet-option-title">Fouled on the black</p>
					<p class="sheet-option-sub">Deducts 1 point from loser's tally</p>
				</div>
			</div>
			<span class="avail-check-indicator">✓</span>
		</div>

		<div class="sheet-actions-row">
			<button type="button" class="sheet-secondary-btn" data-close-sheet>Cancel</button>
			<button type="button" id="custom-submit-game-btn" class="lime-cta-btn" style="flex: 1.6; justify-content: center;">
				Save Result
			</button>
		</div>
	`;

	openBottomSheet(html, (root) => {
		let winnerHome = true;
		const homeSel = root.querySelector('#custom-home-select');
		const awaySel = root.querySelector('#custom-away-select');
		const winHomeBtn = root.querySelector('#custom-win-home-btn');
		const winAwayBtn = root.querySelector('#custom-win-away-btn');

		const syncNames = () => {
			const hUser = state.userMap.get(homeSel.value);
			const aUser = state.userMap.get(awaySel.value);
			if (winHomeBtn && hUser) winHomeBtn.textContent = hUser.team;
			if (winAwayBtn && aUser) winAwayBtn.textContent = aUser.team;
		};

		homeSel?.addEventListener('change', syncNames);
		awaySel?.addEventListener('change', syncNames);

		root.querySelectorAll('[data-winner]').forEach((btn) => {
			btn.addEventListener('click', () => {
				winnerHome = btn.dataset.winner === 'home';
				root.querySelectorAll('[data-winner]').forEach((b) => {
					b.classList.toggle('is-active', b === btn);
				});
			});
		});

		const foulRow = root.querySelector('#custom-foul-toggle');
		foulRow?.addEventListener('click', () => foulRow.classList.toggle('is-checked'));

		root.querySelector('#custom-submit-game-btn')?.addEventListener('click', async () => {
			const homePlayerId = homeSel?.value;
			const awayPlayerId = awaySel?.value;
			if (!homePlayerId || !awayPlayerId || homePlayerId === awayPlayerId) {
				showToast('Select two different players');
				return;
			}

			const ballsRemaining = Number(root.querySelector('#custom-balls-rem')?.value ?? 0);
			const playedAt = root.querySelector('#custom-date-played')?.value || todayIso;
			const fouledOnBlack = Boolean(foulRow?.classList.contains('is-checked'));

			if (!Number.isInteger(ballsRemaining) || ballsRemaining < 0 || ballsRemaining > 8) {
				showToast('Balls remaining must be 0 to 8');
				return;
			}

			await submitNewGame({
				homePlayerId,
				awayPlayerId,
				winnerHome,
				ballsRemaining,
				fouledOnBlack,
				playedAt
			});
		});

		root.querySelector('[data-close-sheet]')?.addEventListener('click', closeBottomSheet);
	});
}

async function submitNewGame(payload) {
	try {
		const res = await fetch('/api/participating/games', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			showToast(err.message || 'Could not save game');
			return;
		}

		closeBottomSheet();
		showToast('Match result logged!');
		await loadLeagueData();
	} catch {
		showToast('Network error logging match');
	}
}

// 5. Result Detail & Edit/Delete Sheet
function openResultDetailSheet(game) {
	const currentUser = getAuthenticatedUser();
	const canEdit = Boolean(currentUser?.participating);
	const homeP = state.userMap.get(game.homePlayerId) || { name: 'Unknown', team: 'Unknown' };
	const awayP = state.userMap.get(game.awayPlayerId) || { name: 'Unknown', team: 'Unknown' };
	const winnerP = game.winnerHome ? homeP : awayP;
	const loserP = game.winnerHome ? awayP : homeP;
	const roundLabel = game.rematchId === 0 ? 'First Match' : `Rematch ${game.rematchId}`;

	const html = `
		<p class="eyebrow">${escapeHTML(formatShortDate(game.playedAt, true))} • ${escapeHTML(roundLabel)}</p>
		<h3 class="sheet-title">${escapeHTML(winnerP.team)} def. ${escapeHTML(loserP.team)}</h3>
		<p class="sheet-subtitle">${escapeHTML(winnerP.name)} beat ${escapeHTML(loserP.name)}</p>

		<div class="stats-trio-grid" style="margin-bottom: 18px;">
			<div class="stat-mini-card">
				<span class="stat-mini-value">${game.ballsRemaining}</span>
				<span class="stat-mini-label">Balls remaining</span>
			</div>
			<div class="stat-mini-card">
				<span class="stat-mini-value">${game.fouledOnBlack ? 'Yes' : 'No'}</span>
				<span class="stat-mini-label">Black foul</span>
			</div>
			<div class="stat-mini-card">
				<span class="stat-mini-value">+3</span>
				<span class="stat-mini-label">Winner pts</span>
			</div>
		</div>

		<div class="sheet-actions-row">
			${
				canEdit
					? `<button type="button" id="delete-game-sheet-btn" class="sheet-danger-btn">Delete</button>`
					: ''
			}
			<button type="button" class="sheet-secondary-btn" data-close-sheet>Close</button>
		</div>
	`;

	openBottomSheet(html, (root) => {
		root.querySelector('#delete-game-sheet-btn')?.addEventListener('click', async () => {
			if (!confirm(`Delete this game (${homeP.team} vs ${awayP.team})?`)) return;
			try {
				const res = await fetch(`/api/participating/games/${encodeURIComponent(game.gameId)}`, {
					method: 'DELETE'
				});
				if (!res.ok) {
					const err = await res.json().catch(() => ({}));
					showToast(err.message || 'Failed to delete game');
					return;
				}
				closeBottomSheet();
				showToast('Game deleted');
				await loadLeagueData();
			} catch {
				showToast('Network error deleting game');
			}
		});
		root.querySelector('[data-close-sheet]')?.addEventListener('click', closeBottomSheet);
	});
}

// 6. Player / Team Standings Detail Sheet (Read-Only Stats)
function openPlayerDetailSheet(rowObj) {
	const ratio =
		rowObj.losses > 0
			? (rowObj.wins / rowObj.losses).toFixed(2)
			: rowObj.wins > 0
			? '∞'
			: '0.00';

	const html = `
		<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
			<span class="team-color-dot" style="width: 16px; height: 16px; background-color: ${escapeHTML(rowObj.teamColor)};"></span>
			<p class="eyebrow" style="margin-bottom: 0;">RANK #${rowObj.rank} • ${escapeHTML(rowObj.name)}</p>
		</div>
		<h3 class="sheet-title">${escapeHTML(rowObj.team)}</h3>
		<p class="sheet-subtitle">${rowObj.played} matches played (${rowObj.wins}W – ${rowObj.losses}L • ${rowObj.foulsOnBlack} black fouls)</p>

		<div class="stats-trio-grid" style="margin-bottom: 18px;">
			<div class="stat-mini-card">
				<span class="stat-mini-value">${rowObj.points}</span>
				<span class="stat-mini-label">Points</span>
			</div>
			<div class="stat-mini-card">
				<span class="stat-mini-value">${rowObj.ballsRemaining}</span>
				<span class="stat-mini-label">Balls remaining</span>
			</div>
			<div class="stat-mini-card">
				<span class="stat-mini-value">${escapeHTML(ratio)}</span>
				<span class="stat-mini-label">W/L Ratio</span>
			</div>
		</div>

		<div class="sheet-actions-row">
			<button type="button" class="sheet-secondary-btn" data-close-sheet>Close</button>
		</div>
	`;

	openBottomSheet(html, (root) => {
		root.querySelector('[data-close-sheet]')?.addEventListener('click', closeBottomSheet);
	});
}

// 7. Profile Field Editor Sheet (Updates Draft, Saved via PATCH /api/auth/profile)
function openProfileEditSheet(field) {
	const isDisplay = field === 'displayName';
	const draft = state.profileDraft;

	const html = `
		<h3 class="sheet-title">${isDisplay ? 'Edit Display Name' : 'Edit Team Details'}</h3>
		<p class="sheet-subtitle">Tap "Save changes" on your profile when you're ready to apply updates.</p>

		${
			isDisplay
				? `
			<div class="sheet-form-group">
				<label class="sheet-form-label" for="edit-disp-name-input">Display Name</label>
				<input type="text" id="edit-disp-name-input" class="sheet-input" value="${escapeHTML(draft.name)}" maxlength="40" />
			</div>
		`
				: `
			<div class="sheet-form-group">
				<label class="sheet-form-label" for="edit-team-name-input">Team Name</label>
				<input type="text" id="edit-team-name-input" class="sheet-input" value="${escapeHTML(draft.team)}" maxlength="40" />
			</div>
			<div class="sheet-form-group">
				<label class="sheet-form-label" for="edit-team-color-input">Team Accent Colour</label>
				<input type="color" id="edit-team-color-input" class="sheet-input" style="height: 50px; padding: 6px;" value="${escapeHTML(draft.teamColor || '#ffffff')}" />
			</div>
		`
		}

		<div class="sheet-actions-row">
			<button type="button" class="sheet-secondary-btn" data-close-sheet>Cancel</button>
			<button type="button" id="apply-profile-field-btn" class="lime-cta-btn" style="flex: 1.4; justify-content: center;">
				Done
			</button>
		</div>
	`;

	openBottomSheet(html, (root) => {
		const inputEl = root.querySelector('input[type="text"]');
		if (inputEl) {
			setTimeout(() => inputEl.focus(), 80);
		}

		root.querySelector('#apply-profile-field-btn')?.addEventListener('click', () => {
			if (isDisplay) {
				const newVal = root.querySelector('#edit-disp-name-input')?.value?.trim();
				if (!newVal) {
					showToast('Display name cannot be empty');
					return;
				}
				state.profileDraft.name = newVal;
			} else {
				const newTeam = root.querySelector('#edit-team-name-input')?.value?.trim();
				const newColor = root.querySelector('#edit-team-color-input')?.value || state.profileDraft.teamColor;
				if (!newTeam) {
					showToast('Team name cannot be empty');
					return;
				}
				state.profileDraft.team = newTeam;
				state.profileDraft.teamColor = newColor;
			}

			renderProfileView();
			closeBottomSheet();
		});

		root.querySelector('[data-close-sheet]')?.addEventListener('click', closeBottomSheet);
	});
}

async function handleSaveProfileChanges() {
	if (!state.isAuthenticated) return;

	const saveBtn = document.getElementById('profile-save-btn');
	const name = (state.profileDraft.name || '').trim();
	const team = (state.profileDraft.team || '').trim();
	const teamColor = state.profileDraft.teamColor || '#ffffff';

	if (!name || !team) {
		showToast('Display name and team name are required');
		return;
	}

	if (saveBtn) {
		saveBtn.disabled = true;
		saveBtn.textContent = 'Saving...';
	}

	try {
		const res = await fetch('/api/auth/profile', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, team, teamColor })
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.message || 'Failed to update profile');
		}

		showToast('Profile updated!');
		await loadLeagueData();
	} catch (error) {
		showToast(error.message || 'Error saving profile');
	} finally {
		if (saveBtn) {
			saveBtn.disabled = false;
			saveBtn.textContent = 'Save changes';
		}
	}
}

/* ==========================================================================
   INITIALIZATION & EVENT LISTENERS
   ========================================================================== */

function initEventListeners() {
	// Bottom navigation tabs
	document.querySelectorAll('.nav-tab').forEach((btn) => {
		btn.addEventListener('click', () => {
			const target = btn.dataset.target;
			if (target) switchTab(target);
		});
	});

	// Browser history navigation
	window.addEventListener('popstate', () => {
		const targetTab = ROUTE_TO_TAB[window.location.pathname] || 'home';
		switchTab(targetTab, { updateHistory: false });
	});

	// Segmented control in Fixtures
	document.querySelectorAll('.segment-btn').forEach((btn) => {
		btn.addEventListener('click', () => {
			const seg = btn.dataset.segment;
			if (seg) switchFixturesSegment(seg);
		});
	});

	// Table column sorting
	document.querySelectorAll('.sort-col-btn').forEach((btn) => {
		btn.addEventListener('click', () => {
			const field = btn.dataset.sort;
			if (!field) return;
			if (state.tableSortField === field) {
				state.tableSortAsc = !state.tableSortAsc;
			} else {
				state.tableSortField = field;
				state.tableSortAsc = field === 'ballsRemaining';
			}
			renderTableView();
		});
	});

	// Cleanly deregister push subscription on device prior to logging out
	document.addEventListener('click', async (event) => {
		const logoutLink = event.target.closest('a[href="/auth/logout"]');
		if (!logoutLink) return;

		if ('serviceWorker' in navigator && 'PushManager' in window) {
			event.preventDefault();
			try {
				const reg = await getSWRegistration();
				const sub = reg ? await reg.pushManager.getSubscription() : null;
				if (sub) {
					await fetch('/api/push-unsubscribe', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ endpoint: sub.endpoint })
					}).catch(() => {});
					await sub.unsubscribe().catch(() => {});
				}
			} catch {
				// Ignore unsubscribe errors during logout
			} finally {
				window.location.href = logoutLink.href;
			}
		}
	});

	// Delegated data-action triggers
	document.addEventListener('click', (e) => {
		const actionEl = e.target.closest('[data-action]');
		if (!actionEl) return;

		const action = actionEl.dataset.action;
		switch (action) {
			case 'open-table-season-sheet':
				openTableSeasonSheet();
				break;
			case 'open-fixtures-filter-sheet':
				openFixturesFilterSheet();
				break;
			case 'open-log-game-sheet':
				openLogGameSheet();
				break;
			case 'go-table':
				state.tableSeasonMode = 'current';
				renderTableView();
				switchTab('table');
				break;
			case 'go-all-results':
				switchTab('fixtures');
				switchFixturesSegment('results');
				break;
			case 'edit-display-name':
				openProfileEditSheet('displayName');
				break;
			case 'edit-team-name':
				openProfileEditSheet('teamName');
				break;
			case 'toggle-notifications':
				handleToggleNotifications();
				break;
		}
	});

	// Save profile button
	document.getElementById('profile-save-btn')?.addEventListener('click', handleSaveProfileChanges);

	// Close bottom sheet when clicking backdrop
	const backdrop = document.getElementById('sheet-backdrop');
	backdrop?.addEventListener('click', (e) => {
		if (e.target === backdrop) {
			closeBottomSheet();
		}
	});

	// Drag-to-dismiss gesture on the bottom sheet
	initBottomSheetDrag();
}

function initInitialRoute() {
	const initialTab = ROUTE_TO_TAB[window.location.pathname] || 'home';
	if (initialTab !== 'home') {
		switchTab(initialTab, { updateHistory: false });
	}
}

function initServiceWorker() {
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker
			.register('/sw.js')
			.then((reg) => {
				reg.update();
			})
			.catch((err) => {
				console.error('ServiceWorker registration failed:', err);
			});
	}
}

document.addEventListener('DOMContentLoaded', () => {
	initInitialRoute();
	initEventListeners();
	initServiceWorker();
	checkAuthAndLoadApp();
});
