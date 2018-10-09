import checkEnvExistence from './checkEnvExistence';

describe('checkEnvExistence', () => {
  it('should error if the environment variable is not set', () => {
    expect(() => {
      checkEnvExistence('UNSET_ENVIRONMENTAL_VARIABLE');
    }).toThrow();
  });

  it('should return true if the environment variable is set', () => {
    process.env.UNSET_ENVIRONMENTAL_VARIABLE = 'new';

    const val = checkEnvExistence('UNSET_ENVIRONMENTAL_VARIABLE');

    expect(val).toBeTruthy();
  });

  afterAll(() => {
    delete process.env.UNSET_ENVIRONMENTAL_VARIABLE;
  });
});
