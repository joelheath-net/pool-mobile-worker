import { html } from 'hono/html';

export const AppShell = ({ canonicalPath = '/' }) => {
	const canonicalUrl = `https://stpaulsleague.joelheath.net${canonicalPath}`;

	return html`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />
	<title>St Paul's League</title>
	<link rel="canonical" href="${canonicalUrl}" />

	<!-- Favicon and Apple Touch Icons -->
	<link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png" />
	<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png" />
	<link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16x16.png" />
	<link rel="manifest" href="/site.webmanifest" />

	<!-- Open Graph / Social -->
	<meta property="og:title" content="St Paul's League" />
	<meta property="og:description" content="Track upcoming fixtures, past results, and league standings for St Paul's Pool League." />
	<meta property="og:image" content="https://stpaulsleague.joelheath.net/images/logo-hd.jpg" />
	<meta property="og:image:width" content="640" />
	<meta property="og:image:height" content="640" />
	<meta property="og:image:alt" content="St Paul's Pool League Logo" />
	<meta property="og:url" content="${canonicalUrl}" />
	<meta property="og:site_name" content="St Paul's League" />
	<meta property="og:locale" content="en_GB" />
	<meta property="og:type" content="website" />

	<!-- PWA & Theme Colors matching new design -->
	<meta name="theme-color" content="#F4F5EF" />
	<meta name="application-name" content="St Paul's League" lang="en" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="St Paul's" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="description" content="Track upcoming fixtures, past results, and league standings for St Paul's Pool League." />
	<meta name="author" content="Joel Heath" />
	<meta name="msapplication-TileColor" content="#173A2B" />

	<!-- Typography -->
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet" />

	<!-- App Styles -->
	<link rel="stylesheet" href="/css/app.css" />
</head>
<body>
	<div id="app-shell" class="app-shell">
		<!-- ==================== UNAUTHENTICATED LANDING VIEW ==================== -->
		<section id="auth-landing" class="auth-landing" aria-label="Sign in to St Paul's League">
			<div class="auth-landing-top">
				<p class="eyebrow">MEMBER PORTAL</p>
				<h1 class="auth-brand-title">St Paul's League</h1>
			</div>

			<div class="auth-landing-center">
				<div class="auth-hero-card">
					<div class="eight-ball-graphic auth-eight-ball" aria-hidden="true">
						<div class="eight-ball-inner">
							<span>8</span>
						</div>
					</div>
					<h2 class="auth-card-heading">Ready for your<br />next frame?</h2>
					<p class="auth-card-subtitle">
						Sign in with your league account to view your fixtures, track live standings, and log match results.
					</p>
					<a href="/auth/google/login" class="lime-cta-btn auth-signin-btn">
						<span class="auth-btn-left">
							<svg class="google-g-icon" viewBox="0 0 24 24" aria-hidden="true">
								<path fill="currentColor" d="M21.8 12.23c0-.71-.06-1.4-.19-2.05H12v3.88h5.5c-.24 1.28-.96 2.36-2.05 3.09v2.57h3.31c1.94-1.78 3.04-4.41 3.04-7.49z"/>
								<path fill="currentColor" d="M12 22c2.76 0 5.07-.91 6.76-2.47l-3.31-2.57c-.91.61-2.08.98-3.45.98-2.65 0-4.9-1.79-5.7-4.2H2.88v2.65C4.56 19.73 8.01 22 12 22z"/>
								<path fill="currentColor" d="M6.3 13.74A6.07 6.07 0 0 1 5.98 12c0-.61.11-1.2.32-1.74V7.61H2.88A9.98 9.98 0 0 0 2 12c0 1.61.39 3.14 1.08 4.39l3.22-2.65z"/>
								<path fill="currentColor" d="M12 5.98c1.5 0 2.85.52 3.91 1.53l2.93-2.93C17.06 2.93 14.75 2 12 2 8.01 2 4.56 4.27 2.88 7.61l3.42 2.65c.8-2.41 3.05-4.28 5.7-4.28z"/>
							</svg>
							<span>Sign in with Google</span>
						</span>
						<svg class="arrow-ne-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<line x1="7" y1="17" x2="17" y2="7"></line>
							<polyline points="7 7 17 7 17 17"></polyline>
						</svg>
					</a>
				</div>
			</div>

			<footer class="auth-landing-footer">
				<p>Sponsored by <a href="https://www.joelheath.net" target="_blank" rel="noopener noreferrer">joelheath.net</a></p>
			</footer>
		</section>

		<!-- ==================== AUTHENTICATED MEMBER APP ==================== -->
		<main id="views-viewport" class="views-viewport" hidden>
			<!-- ==================== 1. HOME VIEW ==================== -->
			<section id="view-home" class="app-view is-active" data-view="home" aria-label="Home">
				<div class="view-scroll">
					<header class="page-header">
						<p class="eyebrow">ST PAUL'S LEAGUE</p>
						<h1 id="home-greeting" class="page-title">Good evening!</h1>
					</header>

					<button type="button" class="context-selector" data-action="open-table-season-sheet" aria-label="Select season standings">
						<span class="context-selector-label" data-bind="context-label">Southampton</span>
						<svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<polyline points="6 9 12 15 18 9"></polyline>
						</svg>
					</button>

					<!-- Hero Card: Your Next Fixture -->
					<div id="home-next-fixture-card" class="hero-card hero-card-home">
						<p class="hero-eyebrow">YOUR NEXT FIXTURE</p>
						<div class="hero-main-row">
							<h2 id="home-hero-headline" class="hero-headline">A big night at<br />the table.</h2>
							<div class="eight-ball-graphic" aria-hidden="true">
								<div class="eight-ball-inner">
									<span>8</span>
								</div>
							</div>
						</div>
						<p id="home-next-meta" class="hero-meta">Loading schedule...</p>
						<p id="home-next-matchup" class="hero-matchup">—</p>
						<button type="button" id="home-view-fixture-btn" class="lime-cta-btn">
							<span>View fixture</span>
							<svg class="arrow-ne-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<line x1="7" y1="17" x2="17" y2="7"></line>
								<polyline points="7 7 17 7 17 17"></polyline>
							</svg>
						</button>
					</div>

					<!-- 3 Stat Cards -->
					<div class="stats-trio-grid">
						<button type="button" class="stat-mini-card" data-action="go-table">
							<span id="home-stat-pos" class="stat-mini-value">—</span>
							<span class="stat-mini-label">League position</span>
						</button>
						<button type="button" class="stat-mini-card" data-action="go-table">
							<span id="home-stat-pts" class="stat-mini-value">—</span>
							<span class="stat-mini-label">Points</span>
						</button>
						<button type="button" class="stat-mini-card" data-action="go-table">
							<span id="home-stat-balls" class="stat-mini-value">—</span>
							<span class="stat-mini-label">Ball difference</span>
						</button>
					</div>

					<!-- Your Last Result -->
					<div class="section-header-row">
						<h2 class="section-title">Your last result</h2>
						<button type="button" class="section-link-btn" data-action="go-all-results">
							<span>All results</span>
							<svg class="arrow-ne-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<line x1="7" y1="17" x2="17" y2="7"></line>
								<polyline points="7 7 17 7 17 17"></polyline>
							</svg>
						</button>
					</div>

					<div id="home-last-result-container"></div>
				</div>
			</section>

			<!-- ==================== 2. TABLE VIEW ==================== -->
			<section id="view-table" class="app-view" data-view="table" aria-label="League Table">
				<div class="view-scroll">
					<header class="page-header">
						<p class="eyebrow">ST PAUL'S LEAGUE</p>
						<h1 class="page-title">League Table</h1>
					</header>

					<button type="button" class="context-selector" data-action="open-table-season-sheet" aria-label="Switch table season">
						<span id="table-season-label" class="context-selector-label">Southampton</span>
						<svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<polyline points="6 9 12 15 18 9"></polyline>
						</svg>
					</button>

					<div class="section-header-row table-section-header">
						<h2 id="table-standings-heading" class="section-title">The current standings</h2>
						<span id="table-live-badge" class="status-pill status-pill-live">LIVE</span>
					</div>

					<div class="surface-card standings-card">
						<div class="standings-header-row" role="row">
							<span class="col-rank">#</span>
							<span class="col-team">Team</span>
							<button type="button" class="col-stat sort-col-btn" data-sort="wins" title="Sort by Wins">W</button>
							<button type="button" class="col-stat sort-col-btn" data-sort="losses" title="Sort by Losses">L</button>
							<button type="button" class="col-diff sort-col-btn" data-sort="ballsRemaining" title="Sort by Balls Remaining">Ball Diff.</button>
							<button type="button" class="col-pts sort-col-btn is-sorted" data-sort="points" title="Sort by Points">Pts</button>
						</div>
						<div id="standings-rows-container" class="standings-body"></div>
					</div>

					<!-- Your Last 5 Games -->
					<div id="table-form-card" class="hero-card form-hero-card">
						<p class="hero-eyebrow">YOUR LAST 5 GAMES</p>
						<div class="form-card-row">
							<h3 id="table-form-headline" class="form-headline">Ready for<br />kickoff!</h3>
							<div id="table-form-badges" class="form-badges-row"></div>
						</div>
					</div>
				</div>
			</section>

			<!-- ==================== 3. FIXTURES VIEW ==================== -->
			<section id="view-fixtures" class="app-view" data-view="fixtures" aria-label="Fixtures">
				<div class="view-scroll">
					<header class="page-header">
						<p class="eyebrow">ST PAUL'S LEAGUE</p>
						<h1 class="page-title">Fixtures</h1>
					</header>

					<button type="button" class="context-selector" data-action="open-fixtures-filter-sheet" aria-label="Filter fixtures and available players">
						<span id="fixtures-filter-label" class="context-selector-label" data-bind="context-label">Southampton</span>
						<svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<polyline points="6 9 12 15 18 9"></polyline>
						</svg>
					</button>

					<!-- Segmented Control: Upcoming | Results -->
					<div class="segmented-control" role="tablist" aria-label="Fixtures view mode">
						<div id="fixtures-segment-pill" class="segmented-pill"></div>
						<button type="button" class="segment-btn is-active" role="tab" aria-selected="true" data-segment="upcoming">
							Upcoming
						</button>
						<button type="button" class="segment-btn" role="tab" aria-selected="false" data-segment="results">
							Results
						</button>
					</div>

					<!-- Subview A: Upcoming -->
					<div id="fixtures-upcoming-pane" class="fixtures-pane is-active">
						<div id="fixtures-hero-container"></div>
						<div id="fixtures-upcoming-list" class="fixtures-list"></div>
					</div>

					<!-- Subview B: Results -->
					<div id="fixtures-results-pane" class="fixtures-pane">
						<div id="fixtures-results-header" class="results-pane-toolbar">
							<span id="results-count-label" class="results-count-label">Completed matches</span>
							<button type="button" id="record-match-btn" class="record-match-pill-btn" data-action="open-log-game-sheet">
								+ Record result
							</button>
						</div>
						<div id="fixtures-results-list" class="fixtures-list"></div>
					</div>
				</div>
			</section>

			<!-- ==================== 4. SEASONS VIEW ==================== -->
			<section id="view-seasons" class="app-view" data-view="seasons" aria-label="Seasons">
				<div class="view-scroll">
					<header class="page-header">
						<p class="eyebrow">ST PAUL'S LEAGUE</p>
						<h1 class="page-title">Seasons</h1>
					</header>

					<!-- Hero Card: Reigning Champions -->
					<div id="seasons-champion-card" class="hero-card champion-hero-card">
						<div class="champion-card-row">
							<div class="champion-card-info">
								<p class="hero-eyebrow">THE REIGNING CHAMPIONS</p>
								<h2 id="champion-team-name" class="champion-title">—</h2>
								<p id="champion-season-name" class="champion-subtitle">—</p>
								<p id="champion-points-line" class="champion-summary">—</p>
							</div>
							<div class="champion-trophy-wrap" aria-hidden="true">
								<svg class="trophy-svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
									<path d="M18 12h28v14c0 8.5-6.2 15-14 15s-14-6.5-14-15V12z" />
									<path d="M18 16H10v6c0 5 3.5 9 8 9" />
									<path d="M46 16h8v6c0 5-3.5 9-8 9" />
									<line x1="32" y1="41" x2="32" y2="52" />
									<path d="M20 52h24" />
									<path d="M16 56h32" />
								</svg>
							</div>
						</div>
					</div>

					<div class="section-header-row seasons-archive-header">
						<h2 class="section-title">Season archive</h2>
						<span id="seasons-count-badge" class="seasons-count-meta">SEASONS</span>
					</div>

					<div id="seasons-archive-list" class="seasons-archive-list"></div>
				</div>
			</section>

			<!-- ==================== 5. PROFILE VIEW ==================== -->
			<section id="view-profile" class="app-view" data-view="profile" aria-label="My Profile">
				<div class="view-scroll">
					<header class="page-header">
						<p class="eyebrow">ST PAUL'S LEAGUE</p>
						<h1 class="page-title">My Profile</h1>
					</header>

					<!-- Dark Green Profile Summary Card -->
					<div class="hero-card profile-hero-card">
						<h2 id="profile-hero-name" class="profile-hero-name">—</h2>
						<div class="profile-hero-footer">
							<span id="profile-hero-team" class="profile-hero-team">—</span>
							<span id="profile-hero-since" class="profile-hero-since">MEMBER</span>
						</div>
					</div>

					<p class="group-eyebrow">PLAYER DETAILS</p>
					<div class="surface-card settings-group-card">
						<button type="button" class="settings-row" data-action="edit-display-name">
							<div class="settings-row-text">
								<span class="settings-label">Display Name</span>
								<span id="profile-display-name-val" class="settings-value">—</span>
							</div>
							<svg class="chevron-right-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<polyline points="9 18 15 12 9 6"></polyline>
							</svg>
						</button>
						<div class="settings-divider"></div>
						<button type="button" class="settings-row" data-action="edit-team-name">
							<div class="settings-row-text">
								<span class="settings-label">Team Name</span>
								<span id="profile-team-name-val" class="settings-value">—</span>
							</div>
							<div class="settings-row-right">
								<span id="profile-team-color-dot" class="team-color-dot"></span>
								<svg class="chevron-right-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
									<polyline points="9 18 15 12 9 6"></polyline>
								</svg>
							</div>
						</button>
					</div>

					<p class="group-eyebrow">PREFERENCES</p>
					<div class="surface-card settings-group-card">
						<button type="button" class="settings-row" data-action="toggle-notifications">
							<div class="settings-row-text">
								<span class="settings-label">Notifications</span>
								<span id="profile-notifications-val" class="settings-value">Off</span>
							</div>
							<svg class="chevron-right-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<polyline points="9 18 15 12 9 6"></polyline>
							</svg>
						</button>
					</div>

					<button type="button" id="profile-save-btn" class="lime-cta-btn profile-save-btn">
						Save changes
					</button>

					<div class="profile-meta-actions">
						<a id="profile-logout-link" href="/auth/logout" class="subtle-auth-link">
							Sign out of St Paul's League
						</a>
					</div>
				</div>
			</section>
		</main>

		<!-- ==================== BOTTOM NAVIGATION ==================== -->
		<nav id="bottom-nav" class="bottom-nav" aria-label="Primary Navigation" hidden>
			<button type="button" class="nav-tab is-active" data-target="home" aria-label="Home" aria-current="page">
				<span class="nav-pill">
					<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1V21H5a1 1 0 0 1-1-1v-9.5z" />
					</svg>
				</span>
				<span class="nav-label">Home</span>
			</button>

			<button type="button" class="nav-tab" data-target="table" aria-label="Table">
				<span class="nav-pill">
					<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<line x1="7" y1="20" x2="7" y2="14" />
						<line x1="12" y1="20" x2="12" y2="6" />
						<line x1="17" y1="20" x2="17" y2="11" />
					</svg>
				</span>
				<span class="nav-label">Table</span>
			</button>

			<button type="button" class="nav-tab" data-target="fixtures" aria-label="Fixtures">
				<span class="nav-pill">
					<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<rect x="4" y="5" width="16" height="15" rx="2" />
						<line x1="8" y1="3.5" x2="8" y2="6.5" />
						<line x1="16" y1="3.5" x2="16" y2="6.5" />
						<line x1="4" y1="10" x2="20" y2="10" />
						<circle cx="8.5" cy="13.5" r="0.8" fill="currentColor" stroke="none" />
						<circle cx="12" cy="13.5" r="0.8" fill="currentColor" stroke="none" />
						<circle cx="15.5" cy="13.5" r="0.8" fill="currentColor" stroke="none" />
						<circle cx="8.5" cy="16.8" r="0.8" fill="currentColor" stroke="none" />
						<circle cx="12" cy="16.8" r="0.8" fill="currentColor" stroke="none" />
						<circle cx="15.5" cy="16.8" r="0.8" fill="currentColor" stroke="none" />
					</svg>
				</span>
				<span class="nav-label">Fixtures</span>
			</button>

			<button type="button" class="nav-tab" data-target="seasons" aria-label="Seasons">
				<span class="nav-pill">
					<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<rect x="3.5" y="5" width="17" height="4" rx="1" />
						<path d="M5 9v10a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V9" />
						<line x1="10" y1="13" x2="14" y2="13" />
					</svg>
				</span>
				<span class="nav-label">Seasons</span>
			</button>

			<button type="button" class="nav-tab" data-target="profile" aria-label="Profile">
				<span class="nav-pill">
					<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<circle cx="12" cy="8.5" r="3.8" />
						<path d="M5.5 19.5c1.5-3.2 3.8-4.8 6.5-4.8s5 1.6 6.5 4.8" />
					</svg>
				</span>
				<span class="nav-label">Profile</span>
			</button>
		</nav>

		<!-- ==================== BOTTOM SHEET MODAL ==================== -->
		<div id="sheet-backdrop" class="sheet-backdrop" hidden>
			<div id="bottom-sheet" class="bottom-sheet" role="dialog" aria-modal="true">
				<div class="sheet-handle-bar"><span></span></div>
				<div id="sheet-content" class="sheet-content"></div>
			</div>
		</div>

		<!-- ==================== TOAST NOTIFICATION ==================== -->
		<div id="app-toast" class="app-toast" role="status" aria-live="polite" hidden></div>
	</div>

	<script src="/js/app.js"></script>
</body>
</html>`;
};
