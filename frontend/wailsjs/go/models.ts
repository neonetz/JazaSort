export namespace cleaner {
	
	export class DuplicateFile {
	    path: string;
	    filename: string;
	    size_mb: number;
	
	    static createFrom(source: any = {}) {
	        return new DuplicateFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.filename = source["filename"];
	        this.size_mb = source["size_mb"];
	    }
	}
	export class DuplicateGroup {
	    hash: string;
	    files: DuplicateFile[];
	
	    static createFrom(source: any = {}) {
	        return new DuplicateGroup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hash = source["hash"];
	        this.files = this.convertValues(source["files"], DuplicateFile);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace config {
	
	export class Rule {
	    category: string;
	    target_folder: string;
	    extensions: string[];
	    keywords: string[];
	    min_size_mb?: number;
	    max_size_mb?: number;
	
	    static createFrom(source: any = {}) {
	        return new Rule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.category = source["category"];
	        this.target_folder = source["target_folder"];
	        this.extensions = source["extensions"];
	        this.keywords = source["keywords"];
	        this.min_size_mb = source["min_size_mb"];
	        this.max_size_mb = source["max_size_mb"];
	    }
	}
	export class Config {
	    source_folders: string[];
	    scan_subfolders: boolean;
	    enable_mica: boolean;
	    hide_unsupported: boolean;
	    rules: Rule[];
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source_folders = source["source_folders"];
	        this.scan_subfolders = source["scan_subfolders"];
	        this.enable_mica = source["enable_mica"];
	        this.hide_unsupported = source["hide_unsupported"];
	        this.rules = this.convertValues(source["rules"], Rule);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace main {
	
	export class ExtStat {
	    ext: string;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new ExtStat(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ext = source["ext"];
	        this.count = source["count"];
	    }
	}
	export class ScanResponse {
	    rootId: string;
	    totalSortable: number;
	    stats: ExtStat[];
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new ScanResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rootId = source["rootId"];
	        this.totalSortable = source["totalSortable"];
	        this.stats = this.convertValues(source["stats"], ExtStat);
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace stats {
	
	export class DailyStat {
	    date: string;
	    files_moved: number;
	    mb_moved: number;
	
	    static createFrom(source: any = {}) {
	        return new DailyStat(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.files_moved = source["files_moved"];
	        this.mb_moved = source["mb_moved"];
	    }
	}
	export class LifetimeStats {
	    total_files: number;
	    total_mb: number;
	    history: Record<string, DailyStat>;
	
	    static createFrom(source: any = {}) {
	        return new LifetimeStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total_files = source["total_files"];
	        this.total_mb = source["total_mb"];
	        this.history = this.convertValues(source["history"], DailyStat, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

