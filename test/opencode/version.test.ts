import { describe, it, expect } from 'vitest';
import { compareVersions, parseVersion } from '../../src/opencode/version';

describe('parseVersion', () => {
  it('should_return_bare_semver', () => {
    expect(parseVersion('1.8.0')).toBe('1.8.0');
  });

  it('should_strip_v_prefix', () => {
    expect(parseVersion('v1.8.0')).toBe('1.8.0');
  });

  it('should_extract_from_decorated_output', () => {
    expect(parseVersion('opencode/1.8.0 (linux arm64)')).toBe('1.8.0');
  });

  it('should_support_two_part_versions', () => {
    expect(parseVersion('11.16')).toBe('11.16');
  });

  it('should_return_null_when_absent', () => {
    expect(parseVersion('not a version')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('should_return_zero_when_equal', () => {
    expect(compareVersions('11.16.0', '11.16.0')).toBe(0);
  });

  it('should_treat_missing_patch_as_zero', () => {
    expect(compareVersions('11.16', '11.16.0')).toBe(0);
  });

  it('should_return_positive_when_left_is_newer', () => {
    expect(compareVersions('11.16.0', '11.15.9')).toBeGreaterThan(0);
    expect(compareVersions('12.0.0', '11.16.0')).toBeGreaterThan(0);
  });

  it('should_return_negative_when_left_is_older', () => {
    expect(compareVersions('10.9.0', '11.16.0')).toBeLessThan(0);
    expect(compareVersions('11.15.9', '11.16.0')).toBeLessThan(0);
  });

  it('should_compare_each_part_left_to_right', () => {
    expect(compareVersions('11.17.0', '11.16.9')).toBeGreaterThan(0);
  });
});
